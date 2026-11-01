import { PROVINCES } from './config';
import type { Report, RouteComparison, RouteResult } from './types';
const province = (value: string) => PROVINCES.find(p => value.startsWith(p.name))?.name ?? value;
const key = (route: RouteResult) => `${province(route.province)}:${route.carrier}:${route.family}:${route.packetType ?? 'unmarked'}`;
// Compare reported route names, never transient target IPs, capitalization or spacing.
function line(value: string | null) {
  if (!value || /^(?:unknown|hidden|failed|未知|未知线路|不支持|无响应|—|--|-)$/i.test(value.trim())) return null;
  return value.replace(/(?:[a-fA-F0-9]{0,4}:){2,}[a-fA-F0-9:.]{0,39}/g, '[IP]').replace(/(?:\d{1,3}\.){3}\d{1,3}/g, '[IP]').replace(/\s+/g, '').toUpperCase();
}
/** Every target uses its own most recent comparable successful sample. Failed probes are not route changes. */
export function compareRoutes(current: Report, history: Report[]): RouteComparison {
  const result: RouteComparison = { compared: 0, changes: [] };
  if (current.status === 'failed') return result;
  const previous = history.filter(report => report.uuid === current.uuid && report.id !== current.id && report.status !== 'failed' && Date.parse(report.completedAt) <= Date.parse(current.startedAt) && (!current.engines?.TcpQuality || !report.engines?.TcpQuality || report.engines.TcpQuality === current.engines.TcpQuality)).sort((a,b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));
  const baselines = new Map<string, { route: RouteResult; report: Report }>();
  for (const report of previous) for (const route of report.routes) {
    if (route.status === 'ok' && line(route.line) && !baselines.has(key(route))) baselines.set(key(route), { route, report });
  }
  const seen = new Set<string>();
  for (const route of current.routes) {
    const id = key(route), before = baselines.get(id), after = line(route.line);
    if (seen.has(id) || route.status !== 'ok' || !after || !before) continue;
    seen.add(id); result.compared++;
    if (line(before.route.line) !== after) result.changes.push({ province: province(route.province), carrier: route.carrier, family: route.family, ...(route.packetType ? { packetType: route.packetType } : {}), before: before.route.line!, after: route.line!, previousReportId: before.report.id, previousCompletedAt: before.report.completedAt });
  }
  return result;
}
