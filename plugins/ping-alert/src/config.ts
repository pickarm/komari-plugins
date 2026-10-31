export type Config = Record<string, unknown>;
export const bool = (v: unknown, fallback: boolean) => typeof v === 'boolean' ? v : fallback;
export const str = (v: unknown, fallback = '') => typeof v === 'string' ? v : fallback;
export function number(v: unknown, fallback: number, min: number, max: number): number {
  const n = Number(v);
  return v == null || v === '' || !Number.isFinite(n) ? fallback : Math.max(min, Math.min(max, n));
}
export const integer = (v: unknown, fallback: number, min: number, max: number) => Math.trunc(number(v, fallback, min, max));
export const ids = (v: unknown) => new Set(Array.isArray(v) ? v.map(String) : []);
export function rules(c: Config) {
  const failureMs = number(c.failure_latency_ms, 200, 0.001, 600000);
  const lossHigh = number(c.loss_failure_percent, 20, 0.001, 100);
  return {
    pingEnabled: bool(c.enabled,true),
    failureCount: integer(c.failure_threshold, 10, 1, 1000),
    recoveryCount: integer(c.recovery_threshold, 2, 1, 1000),
    latencyEnabled: bool(c.latency_enabled, false), failureMs,
    recoveryMs: Math.min(failureMs, number(c.recovery_latency_ms, 150, 0, 600000)),
    lossEnabled: bool(c.loss_enabled, false),
    lossWindow: integer(c.loss_window_probes, 20, 2, 1000),
    lossHigh, lossLow: Math.min(lossHigh, number(c.loss_recovery_percent, 5, 0, 100)),
    lossFailureCount: integer(c.loss_failure_probes, 1, 1, 1000),
    lossRecoveryCount: integer(c.loss_recovery_probes, 2, 1, 1000),
  };
}
export type Rules = ReturnType<typeof rules>;
