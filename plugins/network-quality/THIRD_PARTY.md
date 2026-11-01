# Third-party detection engines

The plugin adapter is AGPL-3.0-only. The following engines retain their upstream copyrights and licenses. Source snapshots in `vendor/` are unmodified and are supplied for audit and corresponding-source access; actual node execution downloads the exact pinned source and checks SHA-256 first. No engine has been run on a real node as part of repository tests.

| Component | Fixed upstream source | SHA-256 | License |
|---|---|---|---|
| TcpQuality core | [708ba0b073a63b10fa8894fb09174e12d01aa665/runTcpQuality-core.sh](https://github.com/ibsgss/TcpQuality/blob/708ba0b073a63b10fa8894fb09174e12d01aa665/runTcpQuality-core.sh) | `e815052b04eb36d332c671d34cb86121ae596a2e8b8375ab6fa150f502e4f712` | GPL-3.0-only; `vendor/TCPQUALITY-LICENSE` |
| IPQuality | [87397e2c3196ec796f5477c83343c2354df601ea/ip.sh](https://github.com/xykt/IPQuality/blob/87397e2c3196ec796f5477c83343c2354df601ea/ip.sh) | `b30df5a3c2204276c54e99dcc5080b46f8a627667730aee7de63b109b8ecaecf` | AGPL-3.0; `vendor/IPQUALITY-LICENSE` |
| NextTrace tiny Linux amd64 | [v1.7.5/nexttrace-tiny_linux_amd64](https://github.com/nxtrace/NTrace-core/releases/download/v1.7.5/nexttrace-tiny_linux_amd64) | `4c25ab6f4000f1473ab928362e406ba0288cbdc034857eeedd83bb0e4d3ce653` | GPL-3.0; [corresponding source v1.7.5](https://github.com/nxtrace/NTrace-core/tree/v1.7.5); `vendor/NEXTTRACE-LICENSE` |
| NextTrace tiny Linux arm64 | [v1.7.5/nexttrace-tiny_linux_arm64](https://github.com/nxtrace/NTrace-core/releases/download/v1.7.5/nexttrace-tiny_linux_arm64) | `e49e5d5cf6fa45ec4b7ac739eba674412b1e044d7502d56878c67ec8cde6c1d4` | GPL-3.0; same corresponding source/license |

NextTrace release digests above were verified against the upstream GitHub release API. The binary is downloaded into the run's private temporary directory and deleted after completion, not bundled or installed in a system directory. Unsupported architectures fail preflight explicitly. IPv6-only jobs do not download the IPv4 large-packet helper.

## Adapter behavior and changes

- TcpQuality runs its **core script directly in the host environment**. The rootfs launcher, benchmark suite, international throughput tests and speed ranking are not invoked. `--no-rank-upload` disables report uploads. Missing dependencies cause a structured preflight failure; normal detection never invokes a package manager.
- After checksum verification, the adapter changes only the core's hard-coded `/tmp/zstatic_nping_` CSV path to `${TMPDIR:-/tmp}/zstatic_nping_`. This keeps output inside the private per-job directory. The reviewed original in `vendor/` remains pristine. CSV bytes are recovered without modifying their content, encoded in the final result envelope, and parsed by the server plugin. IPv4 large-packet rows take precedence over standard IPv4 rows, and `packetType` makes that distinction visible.
- After source checksum verification, IPQuality's temporary copy is filtered by the published `IP_MEDIA_FILTER` adapter in `src/runner.ts`. Exactly thirteen non-media invocations (IP databases/scoring, run telemetry, mail and 50-way DNSBL) and the advertisement launcher are removed; all seven media/AI checks and the original JSON output remain. Anchor/count mismatches fail closed. Cookie and reference URLs are pinned to the same source commit. The pristine original remains in `vendor/`, and this adapter is the corresponding source for these disclosed changes.
- The filtered script runs separately for IPv4 and IPv6 with `-n -p -j -o`: dependency auto-install is skipped, online report upload is disabled, and JSON is written locally. `Media.Status`, `Region` and `Type` are normalized without treating a timeout or unknown result as a definitive block. The adapter does not execute the NodeQuality loader or upload its result archive.
- Detection still contacts upstream target discovery, ASN/geolocation and service endpoints needed by the engines. Disabling online report upload does not make a network test offline.
- The administrator's separate **prepare dependencies** action supports apt/apk with an explicit package list and the same timeout/process-group cleanup as detection. It installs no rootfs, adds no startup service, and does not silently run when viewing public reports.
- Preflight requires Linux, Bash 4+, at least 32 MiB free temporary space, and module-specific commands. Route detection additionally requires root and `CAP_NET_RAW`. Capability flags are checked before launching; runtime network/security failures remain explicit module errors.
- The wrapper uses a per-node lock and private temporary directory, checks checksums before execution, limits each raw artifact to 1 MiB, and includes at most 64 KiB of each diagnostic text log in administrator-only stdout. A complete `NQ_RESULT:` envelope is required to accept a report.

## Fixture provenance

`tests/fixtures/tcpquality.csv` is a synthetic, non-measurement fixture using the exact CSV header and standard/large-packet row layouts emitted by the pinned TcpQuality core. It uses documentation-only IP addresses and domains. `tests/fixtures/ipquality.json` uses the pinned IPQuality `save_json()` object layout and its actual Chinese status labels (`解锁`, `失败`, `仅自制`, `禁会员`, `待支持`, `屏蔽`, `仅网页`). These fixtures test interoperability and failure semantics without network probes or claims of a real node's measured state.

Route direction is the engine's server-to-mainland return path. It does not establish a mainland-to-server outbound traceroute. The adapter does not reverse hop order or label a return path as a forward path.
