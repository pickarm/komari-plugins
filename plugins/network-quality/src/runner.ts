/** Sources are pinned and SHA-256 checked before execution; pristine copies live in vendor/. */
export const ENGINE_SOURCES = {
  tcp: {
    commit: '708ba0b073a63b10fa8894fb09174e12d01aa665',
    url: 'https://raw.githubusercontent.com/ibsgss/TcpQuality/708ba0b073a63b10fa8894fb09174e12d01aa665/runTcpQuality-core.sh',
    sha256: 'e815052b04eb36d332c671d34cb86121ae596a2e8b8375ab6fa150f502e4f712',
  },
  ip: {
    commit: '87397e2c3196ec796f5477c83343c2354df601ea',
    url: 'https://raw.githubusercontent.com/xykt/IPQuality/87397e2c3196ec796f5477c83343c2354df601ea/ip.sh',
    sha256: 'b30df5a3c2204276c54e99dcc5080b46f8a627667730aee7de63b109b8ecaecf',
  },
  nexttrace: {
    release: 'v1.7.5',
    amd64: { url: 'https://github.com/nxtrace/NTrace-core/releases/download/v1.7.5/nexttrace-tiny_linux_amd64', sha256: '4c25ab6f4000f1473ab928362e406ba0288cbdc034857eeedd83bb0e4d3ce653' },
    arm64: { url: 'https://github.com/nxtrace/NTrace-core/releases/download/v1.7.5/nexttrace-tiny_linux_arm64', sha256: 'e49e5d5cf6fa45ec4b7ac739eba674412b1e044d7502d56878c67ec8cde6c1d4' },
  },
} as const;

export const PROVINCE_CODES = ['bj', 'tj', 'he', 'sx', 'nm', 'ln', 'jl', 'hl', 'sh', 'js', 'zj', 'ah', 'fj', 'jx', 'sd', 'ha', 'hb', 'hn', 'gd', 'gx', 'hi', 'cq', 'sc', 'gz', 'yn', 'xz', 'sn', 'gs', 'qh', 'nx', 'xj'] as const;

export interface RunOptions {
  modules: ('routes' | 'unlocks')[];
  ipv: '4' | '6' | 'both';
  provinces: string[];
  count: number;
  parallel: number;
  timeoutMinutes: number;
}

export type RunMode = 'detect' | 'preflight' | 'prepare';

/** Applied only to the checksum-verified IPQuality source. Keep its seven media
 * checks and output schema, removing IP scoring, telemetry, mail and DNSBL work.
 * Exact anchor counts make source drift an explicit failure rather than a full scan. */
export const IP_MEDIA_FILTER = String.raw`/^check_IP\(\)\{/ { inside=1; anchors++ }
inside && ($0 == "countRunTimes" || $0 ~ /^db_/ || $0 ~ /&&db_/ || $0 == "check_mail" || $0 ~ /&&check_dnsbl /) { removed++; next }
/^show_ad$/ { ads++; next }
inside && /^(MediaUnlockTest_|OpenAITest )/ { media++ }
{ print }
inside && /^}$/ { inside=0 }
END { if (anchors != 1 || removed != 13 || ads != 1 || media != 7) exit 42 }`;

function integer(value: number, min: number, max: number, label: string): number {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${label} must be ${min}..${max}`);
  return value;
}

/** The returned command is for Komari's existing Agent remote-execution transport. */
export function buildCommand(jobId: string, options: RunOptions, mode: RunMode = 'detect'): string {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(jobId)) throw new Error('Invalid job id');
  if (!['detect', 'preflight', 'prepare'].includes(mode)) throw new Error('Invalid mode');
  if (!options.modules.length || options.modules.some(x => x !== 'routes' && x !== 'unlocks')) throw new Error('Invalid modules');
  if (!['4', '6', 'both'].includes(options.ipv)) throw new Error('Invalid IP family');
  if (options.provinces.some(x => !(PROVINCE_CODES as readonly string[]).includes(x))) throw new Error('Invalid province');
  const count = integer(options.count, 1, 600, 'count');
  const parallel = integer(options.parallel, 1, 31, 'parallel');
  const seconds = integer(options.timeoutMinutes, 1, 30, 'timeoutMinutes') * 60;
  const routes = options.modules.includes('routes');
  const unlocks = options.modules.includes('unlocks');
  const families = options.ipv === 'both' ? '4 6' : options.ipv;
  const provinces = [...new Set(options.provinces)].map(x => `--province ${x}`).join(' ');
  const routeFlags = options.ipv === 'both' ? '' : `-v${options.ipv}`;
  const engines = JSON.stringify({ ...(routes ? { TcpQuality: ENGINE_SOURCES.tcp.commit, NextTrace: ENGINE_SOURCES.nexttrace.release } : {}), ...(unlocks ? { IPQuality: ENGINE_SOURCES.ip.commit } : {}) });
  // No user text is interpolated into shell syntax: all values above are strict enums/integers.
  return `sh -s <<'KOMARI_NQ_OUTER'
umask 077
MODE=${mode}
JOB=${jobId}
LOCK=/tmp/komari-network-quality.lock
TMP=
OWN_LOCK=0
WORKER=
WATCHDOG=
ERR=
MISSING=
PRE_ERRORS=
PRE_OK=true
RAW_CAP=0
add_error() { ERR="$ERR\\"$1\\","; }
add_pre_error() { PRE_ERRORS="$PRE_ERRORS\\"$1\\","; PRE_OK=false; }
cleanup() {
  trap '' HUP INT TERM
  if [ -n "$WORKER" ]; then kill -TERM "-$WORKER" 2>/dev/null || true; fi
  if [ -n "$WATCHDOG" ]; then kill -TERM "-$WATCHDOG" 2>/dev/null || true; fi
  [ -z "$TMP" ] || rm -rf -- "$TMP"
  if [ "$OWN_LOCK" = 1 ]; then rm -f "$LOCK/pid"; rmdir "$LOCK" 2>/dev/null || true; fi
}
emit() {
  routes_raw=
  ip4_raw=
  ip6_raw=
  if [ -n "$TMP" ]; then
    for log in "$TMP/prepare.log" "$TMP/routes.log" "$TMP/ip4.log" "$TMP/ip6.log"; do
      if [ -s "$log" ]; then printf '\\nNQ_LOG:%s\\n' "\${log##*/}"; head -c 65536 "$log"; printf '\\n'; fi
    done
    [ ! -s "$TMP/routes.csv" ] || routes_raw=$(base64 < "$TMP/routes.csv" | tr -d '\\r\\n')
    [ ! -s "$TMP/ip4.json" ] || ip4_raw=$(base64 < "$TMP/ip4.json" | tr -d '\\r\\n')
    [ ! -s "$TMP/ip6.json" ] || ip6_raw=$(base64 < "$TMP/ip6.json" | tr -d '\\r\\n')
    if [ -s "$TMP/errors" ]; then ERR="$ERR$(cat "$TMP/errors")"; fi
  fi
  payload=$(printf '{"version":1,"mode":"%s","engines":${engines},"preflight":{"ok":%s,"errors":[%s],"missing":[%s],"details":{"jobId":"%s","rawSocketCapability":"%s","engine":"native-pinned","uploads":"disabled"}},"routes":[],"unlocks":[],"errors":[%s],"raw":{"routesCsvBase64":"%s","unlockJsonBase64":{"4":"%s","6":"%s"}}}' "$MODE" "$PRE_OK" "\${PRE_ERRORS%,}" "\${MISSING%,}" "$JOB" "$RAW_CAP" "\${ERR%,}" "$routes_raw" "$ip4_raw" "$ip6_raw")
  printf '\\nNQ_RESULT:'
  printf '%s' "$payload" | base64 | tr -d '\\r\\n'
  printf '\\n'
}
bounded() {
  rm -f "$TMP/timedout"
  setsid "$@" &
  WORKER=$!
  setsid sh -c 'sleep "$1"; : > "$3/timedout"; kill -TERM "-$2" 2>/dev/null || true; sleep 5; kill -KILL "-$2" 2>/dev/null || true' sh ${seconds} "$WORKER" "$TMP" &
  WATCHDOG=$!
  run_rc=0
  wait "$WORKER" || run_rc=$?
  if [ -f "$TMP/timedout" ]; then add_error RUN_TIMEOUT; run_rc=124; fi
  # Also reap detached children if the script leader exited before them.
  kill -KILL "-$WORKER" 2>/dev/null || true
  kill -TERM "-$WATCHDOG" 2>/dev/null || true
  wait "$WATCHDOG" 2>/dev/null || true
  WATCHDOG=
  WORKER=
  return "$run_rc"
}
interrupted() { add_error RUN_INTERRUPTED; emit; cleanup; exit 1; }
trap cleanup EXIT
trap interrupted HUP INT TERM
if ! command -v base64 >/dev/null 2>&1; then printf 'NQ_ERROR:BASE64_MISSING\\n'; exit 1; fi
if ! mkdir "$LOCK" 2>/dev/null; then
  # Recover only an empty, non-symlink lock whose recorded process is gone.
  if [ ! -L "$LOCK" ] && [ -d "$LOCK" ] && [ -r "$LOCK/pid" ]; then
    stale_pid=$(cat "$LOCK/pid")
    case "$stale_pid" in ''|*[!0-9]*) ;; *)
      if ! kill -0 "$stale_pid" 2>/dev/null; then rm -f "$LOCK/pid"; rmdir "$LOCK" 2>/dev/null || true; fi;;
    esac
  fi
  if ! mkdir "$LOCK" 2>/dev/null; then add_pre_error NODE_BUSY; emit; exit 0; fi
fi
OWN_LOCK=1
printf '%s\\n' "$$" > "$LOCK/pid"
TMP=$(mktemp -d /tmp/komari-nq.XXXXXXXX) || { add_pre_error TEMP_DIRECTORY_FAILED; emit; exit 0; }
export TMPDIR="$TMP"
if [ "$(uname -s)" != Linux ]; then add_pre_error LINUX_REQUIRED; fi
if [ -r /etc/NIXOS ]; then add_pre_error NIXOS_MANUAL_DEPENDENCIES_REQUIRED; fi
${routes ? 'if [ "$(id -u)" != 0 ]; then add_pre_error ROUTES_REQUIRE_ROOT; fi' : ''}
${routes && options.ipv !== '6' ? 'case "$(uname -m)" in x86_64|aarch64|arm64) ;; *) add_pre_error LARGE_PROBE_REQUIRES_AMD64_OR_ARM64;; esac' : ''}
if [ -r /proc/self/status ]; then
  cap=$(awk '/^CapEff:/{print $2}' /proc/self/status)
  cap_tail=$(printf '%s' "$cap" | sed 's/.*\\(....\\)$/\\1/')
  case "$cap_tail" in ''|*[!0-9a-fA-F]*) ;; *) RAW_CAP=$(( (0x$cap_tail & 8192) / 8192 ));; esac
fi
${routes ? 'if [ "$RAW_CAP" != 1 ]; then add_pre_error CAP_NET_RAW_REQUIRED; fi' : ''}
free_kb=$(df -Pk "$TMP" 2>/dev/null | awk 'END{print $4}')
case "$free_kb" in ''|*[!0-9]*) add_pre_error DISK_SPACE_UNKNOWN;; *) [ "$free_kb" -ge 32768 ] || add_pre_error DISK_SPACE_BELOW_32MB;; esac
if [ "$MODE" = prepare ]; then
  if [ "$(id -u)" != 0 ]; then add_pre_error PREPARE_REQUIRES_ROOT
  elif ! command -v setsid >/dev/null 2>&1; then add_pre_error PREPARE_REQUIRES_SETSID
  elif command -v apt-get >/dev/null 2>&1; then
    if ! bounded sh -c 'export DEBIAN_FRONTEND=noninteractive; apt-get update && apt-get install -y --no-install-recommends bash curl ca-certificates jq coreutils util-linux procps ${routes ? 'nmap traceroute iproute2' : ''} ${unlocks ? 'bc netcat-openbsd dnsutils iproute2' : ''}' > "$TMP/prepare.log" 2>&1; then add_pre_error DEPENDENCY_INSTALL_FAILED; fi
  elif command -v apk >/dev/null 2>&1; then
    if ! bounded apk add --no-cache bash curl ca-certificates jq coreutils util-linux procps ${routes ? 'nmap-nping traceroute iproute2' : ''} ${unlocks ? 'bc netcat-openbsd bind-tools grep iproute2' : ''} > "$TMP/prepare.log" 2>&1; then add_pre_error DEPENDENCY_INSTALL_FAILED; fi
  else add_pre_error PREPARE_SUPPORTS_APT_OR_APK_ONLY
  fi
fi
for tool in bash curl jq sha256sum setsid awk sed grep cut sort find mktemp df date tr base64 head wc ${routes ? 'nping traceroute ip' : ''} ${unlocks ? 'bc nc dig ip' : ''}; do
  if ! command -v "$tool" >/dev/null 2>&1; then MISSING="$MISSING\\"$tool\\","; PRE_OK=false; fi
done
if [ -n "$MISSING" ]; then add_pre_error DEPENDENCIES_MISSING; fi
if command -v bash >/dev/null 2>&1; then
  if ! bash -c 'test "\${BASH_VERSINFO[0]}" -ge 4'; then add_pre_error BASH_4_REQUIRED; fi
fi
if [ "$MODE" != detect ] || [ "$PRE_OK" != true ]; then emit; exit 0; fi
cat > "$TMP/worker.sh" <<'KOMARI_NQ_WORKER'
set -u
cd "$TMPDIR" || exit 1
: > errors
fail() { printf '"%s",' "$1" >> errors; }
fetch_checked() {
  name=$1 url=$2 sum=$3
  if ! curl --proto '=https' --proto-redir '=https' --tlsv1.2 -fsSL --connect-timeout 15 --max-time 90 "$url" -o "$name"; then fail "DOWNLOAD_$name"; return 1; fi
  if ! printf '%s  %s\\n' "$sum" "$name" | sha256sum -c - >/dev/null 2>&1; then fail "CHECKSUM_$name"; rm -f "$name"; return 1; fi
}
${routes ? `${options.ipv !== '6' ? `mkdir -p "$TMPDIR/bin"
case "$(uname -m)" in
  x86_64) trace_url='${ENGINE_SOURCES.nexttrace.amd64.url}'; trace_sha='${ENGINE_SOURCES.nexttrace.amd64.sha256}' ;;
  aarch64|arm64) trace_url='${ENGINE_SOURCES.nexttrace.arm64.url}'; trace_sha='${ENGINE_SOURCES.nexttrace.arm64.sha256}' ;;
esac
if ! fetch_checked bin/nexttrace-tiny "$trace_url" "$trace_sha"; then exit 1; fi
chmod 700 "$TMPDIR/bin/nexttrace-tiny"
PATH="$TMPDIR/bin:$PATH"
export PATH
` : ''}if fetch_checked tcp.sh '${ENGINE_SOURCES.tcp.url}' '${ENGINE_SOURCES.tcp.sha256}'; then
  # Isolate the upstream CSV path inside this run. No rootfs, upload, speedtest or intl flags.
  sed 's|/tmp/zstatic_nping_|\${TMPDIR:-/tmp}/zstatic_nping_|g' tcp.sh > tcp-native.sh
  if ! env -i PATH="$PATH" HOME="$TMPDIR" TMPDIR="$TMPDIR" TERM=dumb LC_ALL=C TCPQUALITY_NIX_BOOTSTRAPPED=1 bash ./tcp-native.sh --no-rank-upload -c ${count} -p ${parallel} ${routeFlags} ${provinces} > routes.log 2>&1; then fail ROUTES_EXECUTION_FAILED; fi
  for csv in "$TMPDIR"/zstatic_nping_*.csv; do
    if [ -f "$csv" ]; then
      bytes=$(wc -c < "$csv")
      if [ "$bytes" -le 1048576 ]; then cat "$csv" >> routes.csv; else fail ROUTES_OUTPUT_TOO_LARGE; fi
    fi
  done
  [ -s routes.csv ] || fail ROUTES_RESULT_MISSING
fi` : ''}
${unlocks ? `if fetch_checked ip.sh '${ENGINE_SOURCES.ip.url}' '${ENGINE_SOURCES.ip.sha256}'; then
  cat > ip-media-filter.awk <<'KOMARI_NQ_MEDIA_FILTER'
${IP_MEDIA_FILTER}
KOMARI_NQ_MEDIA_FILTER
  if ! awk -f ip-media-filter.awk ip.sh > ip-media-base.sh; then fail UNLOCKS_ADAPTER_SOURCE_MISMATCH; exit 1; fi
  # Pin cookie/reference data too; never fetch mutable main-branch references.
  sed 's|main/ref/|${ENGINE_SOURCES.ip.commit}/ref/|g' ip-media-base.sh > ip-media.sh
  for family in ${families}; do
    # Separate family files handle IPQuality's JSON-stream output without guessing the family.
    if ! env -i PATH="$PATH" HOME="$TMPDIR" TMPDIR="$TMPDIR" TERM=dumb LC_ALL=C bash ./ip-media.sh -"$family" -n -p -j -o "$TMPDIR/ip$family.json" > "ip$family.log" 2>&1; then fail "UNLOCKS_IPV\${family}_EXECUTION_FAILED"; fi
    if [ -s "ip$family.json" ]; then
      bytes=$(wc -c < "ip$family.json")
      if [ "$bytes" -gt 1048576 ]; then rm -f "ip$family.json"; fail "UNLOCKS_IPV\${family}_OUTPUT_TOO_LARGE"; fi
    else fail "UNLOCKS_IPV\${family}_RESULT_MISSING"
    fi
  done
fi` : ''}
KOMARI_NQ_WORKER
if ! bounded sh "$TMP/worker.sh"; then add_error WORKER_EXITED; fi
emit
KOMARI_NQ_OUTER`;
}
