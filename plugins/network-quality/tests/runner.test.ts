import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildCommand, ENGINE_SOURCES, IP_MEDIA_FILTER, type RunOptions } from '../src/runner';
import { parseResult } from '../src/parsers';

const options: RunOptions = { modules:['routes','unlocks'],ipv:'both',provinces:['bj','sh','gd'],count:30,parallel:3,timeoutMinutes:30 };

describe('reviewed remote command', () => {
  it('filters the actual upstream program to seven media checks and rejects changed anchors', () => {
    const source = readFileSync(new URL('../vendor/ipquality.sh', import.meta.url),'utf8');
    const input = `set -eu
ROOT=$(mktemp -d /tmp/nq-media-test.XXXXXXXX)
trap 'rm -rf "$ROOT"' EXIT
cat > "$ROOT/source.sh" <<'NQ_TEST_SOURCE_END'
${source}
NQ_TEST_SOURCE_END
cat > "$ROOT/filter.awk" <<'NQ_TEST_FILTER_END'
${IP_MEDIA_FILTER}
NQ_TEST_FILTER_END
awk -f "$ROOT/filter.awk" "$ROOT/source.sh" > "$ROOT/media.sh"
bash -n "$ROOT/media.sh"
awk '/^check_IP\\(\\)\\{/ { inside=1 } inside { print } inside && /^}$/ { inside=0 }' "$ROOT/media.sh"
sed '/^check_mail$/d' "$ROOT/source.sh" > "$ROOT/drift.sh"
if awk -f "$ROOT/filter.awk" "$ROOT/drift.sh" >/dev/null; then exit 99; fi
printf '\\nSOURCE_DRIFT_REJECTED\\n'
`;
    const executable=process.platform==='win32'?'wsl.exe':'bash';
    const args=process.platform==='win32'?['-d','Ubuntu-24.04','--','bash','-s']:['-s'];
    const output=execFileSync(executable,args,{input,encoding:'utf8',timeout:15000,stdio:['pipe','pipe','pipe']});
    expect(output).toContain('SOURCE_DRIFT_REJECTED');
    expect(output).not.toMatch(/^(?:db_|check_mail$|countRunTimes$)|&&db_|&&check_dnsbl /m);
    expect(output.match(/^(?:MediaUnlockTest_|OpenAITest )/gm)).toHaveLength(7);
    expect(output).toContain('save_json');
  },20000);
  it('pins pristine source downloads to recorded commit and sha256', () => {
    for (const [filename, source] of [['tcpquality-core.sh', ENGINE_SOURCES.tcp], ['ipquality.sh', ENGINE_SOURCES.ip]] as const) {
      const data = readFileSync(new URL(`../vendor/${filename}`, import.meta.url));
      expect(createHash('sha256').update(data).digest('hex')).toBe(source.sha256);
      expect(source.url).toContain(source.commit);
    }
  });
  it('rejects job, province, module and numerical shell injection before producing a command', () => {
    expect(() => buildCommand('bad; id', options)).toThrow();
    expect(() => buildCommand('job', {...options,provinces:['sh;id']})).toThrow();
    expect(() => buildCommand('job', {...options,modules:['x' as 'routes']})).toThrow();
    expect(() => buildCommand('job', {...options,parallel:100})).toThrow();
    expect(() => buildCommand('job', {...options,count:0})).toThrow();
  });
  it('keeps uploads and speed tests disabled and emits only bounded admin logs', () => {
    const command = buildCommand('job', options);
    expect(command).toContain('--no-rank-upload');
    expect(command).toContain('-n -p -j -o');
    expect(command).toContain('head -c 65536');
    expect(command).toContain('NQ_RESULT:');
    expect(command).not.toContain('--speedtest');
    expect(command).not.toContain('runTcpQuality-rootfs.sh');
    expect(command).toContain('CAP_NET_RAW_REQUIRED');
    expect(command).toContain('kill -KILL "-$WORKER"');
  });
  it('uses Linux bash -n to check every mode/module/family shell variant without executing it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nq-shell-syntax-'));
    try {
      for (const mode of ['detect','preflight','prepare'] as const) {
        for (const modules of [['routes'],['unlocks'],['routes','unlocks']] as RunOptions['modules'][]) {
          for (const ipv of ['4','6','both'] as const) {
            const file = join(dir, `${mode}-${modules.join('-')}-${ipv}.sh`);
            writeFileSync(file, buildCommand('test', {...options,modules,ipv}), 'utf8');
            if (process.platform === 'win32') {
              const mounted = `/mnt/${file[0].toLowerCase()}${file.slice(2).replace(/\\/g,'/')}`;
              execFileSync('wsl.exe', ['-d','Ubuntu-24.04','--','bash','-n',mounted], {timeout:15000,stdio:'pipe'});
            } else execFileSync('bash', ['-n',file], {timeout:15000,stdio:'pipe'});
          }
        }
      }
    } finally { rmSync(dir,{recursive:true,force:true}); }
  }, 90000);
  it('returns missing dependencies as structured output and removes its lock/private directory', () => {
    const command = buildCommand('test-preflight', {...options,modules:['unlocks']}, 'preflight');
    const output = fixtureRun(command, false);
    expect(parseResult(output).preflight?.missing).toContain('jq');
    expect(parseResult(output).preflight?.ok).toBe(false);
    expect(output).toContain('NQ_FIXTURE_CLEAN');
  }, 20000);
  it('kills a fake hanging worker and still emits a timeout result and cleans up', () => {
    const command = buildCommand('test-timeout', {...options,modules:['unlocks']})
      .replace(/cat > "\$TMP\/worker\.sh" <<'KOMARI_NQ_WORKER'[\s\S]*?\nKOMARI_NQ_WORKER/, `cat > "$TMP/worker.sh" <<'KOMARI_NQ_WORKER'\nsleep 20\nKOMARI_NQ_WORKER`)
      .replace('sh 1800 "$WORKER"', 'sh 1 "$WORKER"');
    const output = fixtureRun(command, true);
    expect(parseResult(output).errors).toContain('RUN_TIMEOUT');
    expect(output).toContain('NQ_FIXTURE_CLEAN');
  }, 20000);
  it('rejects a live node lock and recovers a lock left by a dead process', () => {
    const command = buildCommand('test-lock', {...options,modules:['unlocks']}, 'preflight');
    expect(parseResult(fixtureRun(command,false,'busy')).preflight?.errors).toContain('NODE_BUSY');
    const stale = fixtureRun(command,false,'stale');
    expect(parseResult(stale).preflight?.errors).not.toContain('NODE_BUSY');
    expect(stale).toContain('NQ_FIXTURE_CLEAN');
  }, 20000);
});

/** Local WSL-only fixture. No downloaded engine is executed; missing tools are explicit stubs. */
function fixtureRun(command: string, allTools: boolean, lock?: 'busy' | 'stale'): string {
  const tools = 'sh bash mkdir rm rmdir mktemp uname id awk sed df base64 tr head cat setsid sleep grep cut sort find date wc chmod';
  const setup = `set -eu
ROOT=$(mktemp -d /tmp/nq-runner-test.XXXXXXXX)
trap 'rm -rf "$ROOT"' EXIT
mkdir "$ROOT/bin"
${lock ? `mkdir "$ROOT/lock"; printf '%s\\n' ${lock === 'busy' ? '"$$"' : '999999999'} > "$ROOT/lock/pid"` : ''}
for tool in ${tools}; do ln -s "$(command -v "$tool")" "$ROOT/bin/$tool"; done
${allTools ? `for tool in curl jq sha256sum bc nc dig ip; do printf '#!/bin/sh\\nexit 0\\n' > "$ROOT/bin/$tool"; chmod +x "$ROOT/bin/$tool"; done` : ''}
export NQ_FIXTURE_ROOT="$ROOT"
PATH="$ROOT/bin"
export PATH
`;
  const isolated = command.replace('LOCK=/tmp/komari-network-quality.lock', 'LOCK="$NQ_FIXTURE_ROOT/lock"').replace('mktemp -d /tmp/komari-nq.XXXXXXXX', 'mktemp -d "$NQ_FIXTURE_ROOT/komari-nq.XXXXXXXX"');
  const input = `${setup}${isolated}\nif [ ! -d "$ROOT/lock" ] && ! find "$ROOT" -name 'komari-nq.*' | grep . >/dev/null; then printf 'NQ_FIXTURE_CLEAN\\n'; fi\n`;
  const executable = process.platform === 'win32' ? 'wsl.exe' : 'bash';
  const args = process.platform === 'win32' ? ['-d','Ubuntu-24.04','--','bash','-s'] : ['-s'];
  return execFileSync(executable,args,{input,encoding:'utf8',timeout:18000,stdio:['pipe','pipe','pipe']});
}
