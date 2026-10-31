export type ReportKind = 'daily' | 'weekly' | 'monthly' | 'custom';
export type PingStat = {
  entity_id: string; task_id: string; total: number; valid: number;
  avg?: number | null; loss: number; loss_approximate?: boolean;
};
export function reportRange(kind: ReportKind, now: Date, customHours = 6) {
  if (kind === 'custom') return { start: new Date(now.getTime() - customHours * 3600000), end: now };
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(end);
  if (kind === 'daily') start.setDate(start.getDate() - 1);
  if (kind === 'weekly') {
    end.setDate(end.getDate() - (end.getDay() + 6) % 7);
    start.setTime(end.getTime()); start.setDate(start.getDate() - 7);
  }
  if (kind === 'monthly') {
    end.setDate(1); start.setTime(end.getTime()); start.setMonth(start.getMonth() - 1);
  }
  return { start, end };
}
export function summarize(stats: PingStat[]) {
  let total = 0, lost = 0, valid = 0, latencySum = 0;
  let approximate = false;
  for (const s of stats) {
    if (!Number.isFinite(s.total) || s.total <= 0 || !Number.isFinite(s.loss)) continue;
    total += s.total; lost += s.total * s.loss / 100;
    approximate ||= !!s.loss_approximate;
    if (typeof s.avg === 'number' && Number.isFinite(s.avg) && s.avg >= 0 && s.valid > 0) {
      valid += s.valid; latencySum += s.avg * s.valid;
    }
  }
  return { total, averageLatency: valid ? latencySum / valid : null,
    averageLoss: total ? lost / total * 100 : null, approximate };
}
export const latencyText = (v: number | null | undefined) => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? `${v.toFixed(2)} ms` : '无成功采样';
export const lossText = (v: number | null) => v === null ? '无数据' : `${v.toFixed(2)}%`;
