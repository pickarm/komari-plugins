import { definePlugin, server } from '@komari-monitor/plugin-sdk';
import { bool, ids, integer, number, rules, str, type Config } from './config';
import { freshMonitor, processProbes, type Monitor, type Probe, type Change } from './monitor';
import { reportRange, summarize, latencyText, lossText, type ReportKind, type PingStat } from './reports';

const fs = require('fs');
const stateFile = `${__storageDir__}/state-v2.json`;
type Task = { id: number; name?: string; target?: string; interval?: number; clients?: string[] };
type Nodes = Record<string, { name?: string }>;
type Event = { event: string; message: string; time: string; emoji: string; clients?: {uuid: string}[] };
type Pending = { id: string; scope: string; payload: Event; attempts: number; next: number };
type ReportRequest = { kind: ReportKind; start: string; end: string; next: number; attempts: number };
type State = { version: 2; entries: Record<string, Monitor>; pending: Pending[]; reports: Record<string, string>; requests: ReportRequest[] };
let state: State;
let sessionStart: string;
let chain = Promise.resolve();
const jobs = new Set<string>();

function save() {
  fs.mkdirSync(__storageDir__, { recursive: true });
  fs.writeFileSync(`${stateFile}.tmp`, JSON.stringify(state), 'utf8');
  fs.renameSync(`${stateFile}.tmp`, stateFile);
}
function readState(): State {
  if (!fs.existsSync(stateFile)) {
    const initial: State = { version: 2, entries: {}, pending: [], reports: {}, requests: [] };
    const legacyPath = `${__storageDir__}/state.json`;
    if (fs.existsSync(legacyPath)) {
      const legacy = JSON.parse(fs.readFileSync(legacyPath, 'utf8'));
      for (const [key, old] of Object.entries(legacy.entries ?? {}) as [string, {alertActive?: boolean}][]) {
        const monitor = freshMonitor(sessionStart); monitor.ping.active = old.alertActive === true;
        initial.entries[key] = monitor;
      }
      if (legacy.pending?.length) console.warn('ping-alert: legacy queued notifications remain in state.json; history replay disabled in v1.1');
    }
    return initial;
  }
  const parsed = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  if (parsed.version !== 2 || !parsed.entries || !Array.isArray(parsed.pending) || !parsed.reports) throw new Error('Invalid persistent plugin state; restore state-v2.json from backup');
  parsed.requests ??= [];
  return parsed;
}
function job(key: string, fn: () => Promise<void>) {
  return () => {
    if (jobs.has(key)) return chain;
    jobs.add(key);
    chain = chain.then(fn).catch((e) => console.error('ping-alert %s: %s', key, String(e))).finally(() => jobs.delete(key));
    return chain;
  };
}
function put(id: string, scope: string, payload: Event) {
  if (state.pending.some(p => p.id === id)) return;
  if (state.pending.length >= 1000) throw new Error('Notification queue full; check notification channels');
  state.pending.push({ id, scope, payload, attempts: 0, next: 0 });
}
async function flush(c: Config) {
  const blocked = new Set<string>();
  for (const p of [...state.pending]) {
    if (blocked.has(p.scope)) continue;
    if (p.next > Date.now()) { blocked.add(p.scope); continue; }
    if ((p.scope.startsWith('alert:') && !bool(c.enabled, true)) ||
      (p.scope.startsWith('report:') && !bool(c[`${p.scope.slice(7)}_enabled`], false))) continue;
    try {
      await server.call('admin:sendNotification', { event: p.payload });
      state.pending = state.pending.filter(item => item.id !== p.id);
    } catch (e) {
      p.attempts++; p.next = Date.now() + Math.min(3600000, 30000 * 2 ** Math.min(p.attempts, 7));
      blocked.add(p.scope); console.error('ping-alert: delivery queued for retry: %s', String(e));
    }
    save();
  }
}
async function scope(c: Config) {
  const [allTasks, nodes] = await Promise.all([
    server.call<Task[]>('admin:getAllPingTasks'), server.call<Nodes>('common:getNodes'),
  ]);
  const selectedTasks = ids(c.ping_tasks), selectedNodes = ids(c.nodes);
  return { nodes, tasks: allTasks.filter(t => bool(c.all_tasks, true) || selectedTasks.has(String(t.id))).map(t => ({
    ...t, clients: [...new Set(t.clients ?? [])].filter(id => nodes[id] && (bool(c.all_nodes, true) || selectedNodes.has(id))),
  })).filter(t => t.clients.length) };
}
function alertEvent(change: Change, task: Task, uuid: string, nodes: Nodes, c: Config): Event {
  const event = change.rule === 'ping' ? (change.recovered ? 'PingRecovery' : 'PingFailure')
    : (change.recovered ? 'PingLossRecovery' : 'PingLossFailure');
  const title = `${change.rule === 'ping' ? 'Ping 探测' : 'Ping 丢包率'}${change.recovered ? '恢复' : '异常'}`;
  const message = [title, `任务：${task.name || task.id}`, `节点：${nodes[uuid]?.name || uuid}`,
    `目标：${task.target || '-'}`, `连续${change.recovered ? '恢复' : '异常'}探测：${change.count} 次`,
    `本次延迟：${change.latency < 0 ? '超时/失败' : latencyText(change.latency)}`,
    `最近 ${rules(c).lossWindow} 次丢包率：${lossText(change.lossPercent)}`, `探测时间：${change.time}`].join('\n');
  const values: Record<string, string> = { task: task.name || String(task.id), task_id: String(task.id),
    node: nodes[uuid]?.name || uuid, uuid, target: task.target || '-', count: String(change.count),
    latency: change.latency < 0 ? '超时/失败' : latencyText(change.latency), loss: lossText(change.lossPercent),
    time: change.time, event, message };
  const template = str(change.recovered ? c.recovery_template : c.failure_template);
  return { event, emoji: change.recovered ? '✅' : '🚨', time: change.time, clients: [{ uuid }],
    message: template.trim() ? template.replace(/\{\{(\w+)\}\}/g, (m, k: string) => values[k] ?? m) : message };
}
async function poll() {
  const c = await server.getConfig<Config>();
  if (!bool(c.enabled, true)) { await flush(c); await drainReports(); return; }
  const r = rules(c), selected = await scope(c), active = new Set<string>();
  for (const task of selected.tasks) {
    for (const uuid of task.clients) active.add(`${task.id}:${uuid}`);
    // Query only samples observed during this load, never replay earlier incidents.
    const end = new Date();
    const cursor = Math.min(...task.clients.map(uuid => Date.parse(state.entries[`${task.id}:${uuid}`]?.last || sessionStart)));
    const start = new Date(Math.max(Date.parse(sessionStart), cursor - 1, end.getTime() - 300000));
    if (start >= end) continue;
    try {
      const response = await server.call<{series?: {entity_id: string; downsampled: boolean; points?: Probe[]}[]}>('public:queryMetrics', {
        metric_keys: ['ping.latency_ms'], tags: { task_id: String(task.id) }, entity_ids: task.clients,
        start: start.toISOString(), end: end.toISOString(), fill_empty: false, max_points: 10000,
      });
      const series = response.series ?? [];
      if (series.some(s => s.downsampled !== false)) throw new Error('Aggregated data rejected: raw probes required');
      const byNode = new Map(series.map(s => [s.entity_id, s.points ?? []]));
      for (const uuid of task.clients) {
        const key = `${task.id}:${uuid}`;
        const previous = state.entries[key] || freshMonitor(sessionStart);
        const result = processProbes(previous, byNode.get(uuid) ?? [], r, Math.max(90, (task.interval || 60) * 3));
        for (const change of result.changes) {
          if (change.recovered && !bool(c.notify_recovery, true)) continue;
          put(`${key}:${change.rule}:${change.time}:${change.recovered}`, `alert:${key}:${change.rule}`,
            alertEvent(change, task, uuid, selected.nodes, c));
        }
        state.entries[key] = result.state;
      }
    } catch (e) { console.error('ping-alert task %s: %s', task.id, String(e)); }
  }
  for (const key of Object.keys(state.entries)) if (!active.has(key)) delete state.entries[key];
  state.pending = state.pending.filter(p => !p.scope.startsWith('alert:') ||
    (active.has(p.scope.split(':').slice(1, 3).join(':')) && (!p.scope.endsWith(':loss') || r.lossEnabled)));
  save(); await flush(c); await drainReports();
}
async function report(request: ReportRequest) {
  const {kind} = request;
  const c = await server.getConfig<Config>();
  if (!bool(c[`${kind}_enabled`], false)) return;
  const start = new Date(request.start), end = new Date(request.end);
  const rangeKey = `${start.toISOString()}/${end.toISOString()}`;
  if (state.reports[kind] === rangeKey) return;
  const {tasks, nodes} = await scope(c);
  const lines: string[] = [], allStats: PingStat[] = [];
  for (const task of tasks) {
    const response = await server.call<{stats: PingStat[]}>('public:getPingMetricStats', {
      entity_ids: task.clients, task_ids: [task.id], start: start.toISOString(),
      end: new Date(end.getTime() - 1).toISOString(), max_points: 10000,
    });
    const matching = response.stats.filter(s => String(s.task_id) === String(task.id) && task.clients.includes(s.entity_id));
    allStats.push(...matching);
    for (const uuid of task.clients) {
      const stat = matching.find(s => s.entity_id === uuid);
      lines.push(`${task.name || task.id} / ${nodes[uuid]?.name || uuid}：${stat && stat.total > 0
        ? `平均延迟 ${latencyText(stat.avg)}，平均丢包率 ${lossText(stat.loss)}${stat.loss_approximate ? '（估算）' : ''}，${stat.total} 次探测`
        : '无数据'}`);
    }
  }
  const totals = summarize(allStats);
  const label = {daily: '日报', weekly: '周报', monthly: '月报', custom: '自定义周期报告'}[kind];
  const event = `Ping${kind[0].toUpperCase()}${kind.slice(1)}Report`;
  const message = [`Ping ${label}`, `${start.toISOString()} 至 ${end.toISOString()}（不含终点）`,
    `总体平均延迟：${totals.total ? latencyText(totals.averageLatency) : '无数据'}`,
    `总体平均丢包率：${lossText(totals.averageLoss)}${totals.approximate ? '（含估算）' : ''}`,
    `实际探测总数：${totals.total}`, ...lines,
    '统计源：Komari 历史聚合数据；缺报不计为丢包，保存期不足时只覆盖现存数据。'].join('\n');
  const id = `report:${kind}:${rangeKey}`;
  put(id, `report:${kind}`, {event, message, emoji: '📊', time: new Date().toISOString()});
  state.reports[kind] = rangeKey; save(); await flush(c);
}
async function drainReports() {
  const request = state.requests.find(r => r.next <= Date.now());
  if (!request) return;
  try {
    await report(request);
    state.requests = state.requests.filter(r => r !== request);
  } catch (e) {
    request.attempts++;
    request.next = Date.now() + Math.min(3600000, 30000 * 2 ** Math.min(request.attempts, 7));
    console.error('ping-alert report queued for retry: %s', String(e));
  }
  save();
}
async function requestReport(kind: ReportKind) {
  const c = await server.getConfig<Config>();
  if (!bool(c[`${kind}_enabled`], false)) return;
  const {start, end} = reportRange(kind, new Date(), number(c.custom_hours, 6, 0.05, 8760));
  const startText = start.toISOString(), endText = end.toISOString();
  if (state.reports[kind] === `${startText}/${endText}` || state.requests.some(r => r.kind === kind && r.start === startText && r.end === endText)) return;
  if (state.requests.length >= 100) throw new Error('Report request queue full; check metrics API');
  state.requests.push({kind, start:startText, end:endText, next:0, attempts:0}); save();
  await drainReports();
}
definePlugin({
  async load() {
    sessionStart = new Date().toISOString(); state = readState();
    for (const [key, old] of Object.entries(state.entries)) state.entries[key] = freshMonitor(sessionStart, old);
    save();
    // Internal transport cadence is not an alert rule or user-facing setting.
    server.cron('@every 10s', job('poll', poll));
    const c = await server.getConfig<Config>();
    const schedules: Record<ReportKind, string> = {daily: '0 9 * * *', weekly: '0 9 * * 1', monthly: '0 9 1 * *', custom: '0 */6 * * *'};
    for (const kind of Object.keys(schedules) as ReportKind[]) {
      if (!bool(c[`${kind}_enabled`], false)) continue;
      // Bad report schedules must not disable live Ping monitoring.
      try { server.cron(str(c[`${kind}_cron`], schedules[kind]).trim(), job(`report-${kind}`, () => requestReport(kind))); }
      catch (e) { console.error('ping-alert invalid %s report schedule: %s', kind, String(e)); }
    }
    await job('poll', poll)();
  },
});
