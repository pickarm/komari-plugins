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
  // New keys intentionally ignore the former toggle/200ms/150ms defaults on upgrade.
  const failureValue = number(c.failure_delay_ms, -1, -1, 600000);
  const failureMs = failureValue < 0 ? -1 : failureValue;
  const recoveryText = c.recovery_delay_ms;
  const recoveryNumber = Number(recoveryText);
  const recoveryMs = recoveryText == null || recoveryText === '' || recoveryText === '不限' ||
    !Number.isFinite(recoveryNumber) || recoveryNumber < 0 ? null : Math.min(recoveryNumber, 600000);
  const lossHigh = number(c.loss_failure_percent, 20, 0.001, 100);
  return {
    pingEnabled: bool(c.enabled,true),
    failureCount: integer(c.failure_threshold, 10, 1, 1000),
    recoveryCount: integer(c.recovery_threshold, 2, 1, 1000),
    failureMs, recoveryMs,
    lossEnabled: bool(c.loss_enabled, false),
    lossWindow: integer(c.loss_window_probes, 20, 2, 1000),
    lossHigh, lossLow: Math.min(lossHigh, number(c.loss_recovery_percent, 5, 0, 100)),
    lossFailureCount: integer(c.loss_failure_probes, 1, 1, 1000),
    lossRecoveryCount: integer(c.loss_recovery_probes, 2, 1, 1000),
  };
}
export type Rules = ReturnType<typeof rules>;
