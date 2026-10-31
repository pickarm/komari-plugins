import type { Rules } from './config';
export type Probe = { time: string; value: number | null };
type RuleState = { active: boolean; bad: number; good: number };
export type Monitor = {
  last: string; ping: RuleState; loss: RuleState; window: number[];
};
export type Change = {
  rule: 'ping' | 'loss'; recovered: boolean; time: string; count: number;
  latency: number; lossPercent: number | null;
};
export function freshMonitor(time: string, old?: Monitor): Monitor {
  return { last: time, ping: { active: old?.ping.active ?? false, bad: 0, good: 0 },
    loss: { active: old?.loss.active ?? false, bad: 0, good: 0 }, window: [] };
}
function advance(s: RuleState, bad: boolean, good: boolean, failN: number, recoverN: number): boolean | null {
  s.bad = bad ? Math.min(failN, s.bad + 1) : 0;
  s.good = good ? Math.min(recoverN, s.good + 1) : 0;
  if (!s.active && s.bad >= failN) { s.active = true; s.good = 0; return false; }
  if (s.active && s.good >= recoverN) { s.active = false; s.bad = 0; return true; }
  return null;
}
export function processProbes(previous: Monitor, probes: Probe[], r: Rules, maxGapSeconds: number) {
  const state: Monitor = JSON.parse(JSON.stringify(previous));
  const changes: Change[] = [];
  for (const p of [...probes].sort((a, b) => Date.parse(a.time) - Date.parse(b.time))) {
    const ts = Date.parse(p.time);
    if (!Number.isFinite(ts) || ts <= Date.parse(state.last) || typeof p.value !== 'number' || !Number.isFinite(p.value)) continue;
    if (ts - Date.parse(state.last) > maxGapSeconds * 1000) {
      state.ping.bad = state.ping.good = state.loss.bad = state.loss.good = 0;
      state.window = [];
    }
    state.last = p.time;
    const timeout = p.value < 0;
    state.window.push(timeout ? 1 : 0);
    state.window = state.window.slice(-r.lossWindow);
    const loss = state.window.length === r.lossWindow ? state.window.reduce((a, b) => a + b, 0) / r.lossWindow * 100 : null;
    const pingChange = advance(state.ping, timeout || (r.latencyEnabled && p.value > r.failureMs),
      !timeout && (!r.latencyEnabled || p.value <= r.recoveryMs), r.failureCount, r.recoveryCount);
    if (pingChange !== null) changes.push({ rule: 'ping', recovered: pingChange, time: p.time,
      count: pingChange ? r.recoveryCount : r.failureCount, latency: p.value, lossPercent: loss });
    if (r.lossEnabled && loss !== null) {
      const lossChange = advance(state.loss, loss >= r.lossHigh, loss <= r.lossLow && loss < r.lossHigh,
        r.lossFailureCount, r.lossRecoveryCount);
      if (lossChange !== null) changes.push({ rule: 'loss', recovered: lossChange, time: p.time,
        count: lossChange ? r.lossRecoveryCount : r.lossFailureCount, latency: p.value, lossPercent: loss });
    } else if (!r.lossEnabled) state.loss = { active: false, bad: 0, good: 0 };
  }
  return { state, changes };
}
