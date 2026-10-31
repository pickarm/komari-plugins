import { definePlugin, server } from '@komari-monitor/plugin-sdk';
import { bool, ids, integer, number, rules, str, type Config } from './config';
import { freshMonitor, processProbes, type Monitor, type Probe, type Change } from './monitor';
import { reportRange, summarize, latencyText, lossText, type ReportKind, type PingStat } from './reports';
import {prepareNotice,plainText,localTime,reportMetrics,metricKey,type Notice} from './notifications';
import type {PluginRequest,PluginResponse} from '@komari-monitor/plugin-sdk';

const fs = require('fs');
const stateFile = `${__storageDir__}/state-v2.json`;
type Task = { id: number; name?: string; target?: string; interval?: number; clients?: string[] };
type Nodes = Record<string, { name?: string }>;
type Event = Notice;
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
    if ((p.scope.startsWith('alert:') && !(p.scope.endsWith(':loss')?bool(c.loss_enabled,false):bool(c.enabled,true))) ||
      (p.scope.startsWith('report:') && (!bool(c[`${p.scope.slice(7)}_enabled`], false)||!metricKey(c)||p.payload.metrics!==metricKey(c)))) {
      state.pending=state.pending.filter(item=>item.id!==p.id);save();continue;
    }
    try {
      await deliver(p.payload);
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
  const code = change.rule === 'ping' ? (change.recovered ? 'PingRecovery' : 'PingFailure')
    : (change.recovered ? 'PingLossRecovery' : 'PingLossFailure');
  const event = `${change.rule === 'ping' ? '探测' : '丢包率'}${change.recovered ? '恢复' : '异常'}`;
  const flags=reportMetrics(c);
  const message = [event, `任务：${task.name || task.id}`, `节点：${nodes[uuid]?.name || uuid}`,
    `目标：${task.target || '-'}`, `连续${change.recovered ? '恢复' : '异常'}探测：${change.count} 次`,
    ...(flags.ping?[`本次延迟：${change.latency < 0 ? '超时/失败' : latencyText(change.latency)}`]:[]),
    ...(flags.loss?[`最近 ${rules(c).lossWindow} 次丢包率：${lossText(change.lossPercent)}`]:[]), `探测时间：${localTime(change.time,c)}`].join('\n');
  const values: Record<string, string> = { task: task.name || String(task.id), task_id: String(task.id),
    node: nodes[uuid]?.name || uuid, uuid, target: task.target || '-', count: String(change.count),
    latency: change.latency < 0 ? '超时/失败' : latencyText(change.latency), loss: lossText(change.lossPercent),
    time: localTime(change.time,c), event, event_code:code, message };
  const template = str(change.recovered ? c.recovery_template : c.failure_template);
  return { event, code, emoji: change.recovered ? '✅' : '🚨', time: change.time, clients: [{ uuid }],clientLabel:nodes[uuid]?.name||uuid,
    message: template.trim() ? plainText(template).replace(/\{\{(\w+)\}\}/g, (m, k: string) => values[k] ?? m) : message };
}
async function deliveryPreview(payload:Event) {
  const s=await server.call<Config>('admin:getSettings');
  // Only extract non-secret notification presentation settings; never expose the full settings map.
  return prepareNotice(payload,{notification_method:s.notification_method,notification_template:s.notification_template,notification_enabled:s.notification_enabled});
}
async function deliver(payload:Event) {
  const prepared=await deliveryPreview(payload);
  if(!prepared.ready) throw new Error('请先开启 Komari 通知并选择通知渠道');
  await server.call('admin:sendNotification',{event:prepared.payload});
}
async function poll() {
  const c = await server.getConfig<Config>();
  if (!metricKey(c)) {state.entries={};state.requests=[];await flush(c);save();return;}
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
    (active.has(p.scope.split(':').slice(1, 3).join(':')) && (p.scope.endsWith(':loss')?r.lossEnabled:r.pingEnabled)));
  save(); await flush(c); await drainReports();
}
async function report(request: ReportRequest) {
  const {kind} = request;
  const c = await server.getConfig<Config>();
  if (!bool(c[`${kind}_enabled`], false)||!metricKey(c)) return;
  const start = new Date(request.start), end = new Date(request.end);
  const rangeKey = `${start.toISOString()}/${end.toISOString()}`;
  if (state.reports[kind] === rangeKey) return;
  const {tasks, nodes} = await scope(c);
  const allStats: PingStat[] = [];
  for (const task of tasks) {
    const response = await server.call<{stats: PingStat[]}>('public:getPingMetricStats', {
      entity_ids: task.clients, task_ids: [task.id], start: start.toISOString(),
      end: new Date(end.getTime() - 1).toISOString(), max_points: 10000,
    });
    const matching = response.stats.filter(s => String(s.task_id) === String(task.id) && task.clients.includes(s.entity_id));
    allStats.push(...matching);
  }
  const payload=reportEvent(c,kind,start,end,tasks,nodes,allStats);
  if(!payload)return;
  const id = `report:${kind}:${rangeKey}`;
  put(id, `report:${kind}`, payload);
  state.reports[kind] = rangeKey; save(); await flush(c);
}
function reportEvent(c:Config,kind:ReportKind,start:Date,end:Date,tasks:Task[],nodes:Nodes,allStats:PingStat[]):Event|null {
  const flags=reportMetrics(c);if(!flags.ping&&!flags.loss)return null;
  const totals=summarize(allStats),lines:string[]=[];
  for(const task of tasks) for(const uuid of task.clients??[]) {
    const stat=allStats.find(s=>String(s.task_id)===String(task.id)&&s.entity_id===uuid);
    const metrics=stat&&stat.total>0?[
      ...(flags.ping?[`平均延迟：${latencyText(stat.avg)}`]:[]),
      ...(flags.loss?[`平均丢包率：${lossText(stat.loss)}${stat.loss_approximate?'（估算）':''}`]:[]),
      `实际探测：${stat.total} 次`]:['无数据'];
    lines.push(`任务：${task.name||task.id}\n节点：${nodes[uuid]?.name||uuid}\n${metrics.join('\n')}`);
  }
  const label = {daily: '日报', weekly: '周报', monthly: '月报', custom: '自定义周期报告'}[kind];
  const event=`探测${label}`,code=`Ping${kind[0].toUpperCase()}${kind.slice(1)}Report`;
  const message=[event,`统计开始：${localTime(start.toISOString(),c)}`,`统计结束：${localTime(end.toISOString(),c)}（不含终点）`,'',
    ...(flags.ping?[`总体平均延迟：${totals.total?latencyText(totals.averageLatency):'无数据'}`]:[]),
    ...(flags.loss?[`总体平均丢包率：${lossText(totals.averageLoss)}${totals.approximate?'（含估算）':''}`]:[]),
    `实际探测总数：${totals.total}`,'',lines.join('\n\n'),'',
    flags.loss?'注：仅统计现存探测记录，缺报不计入丢包。':'注：仅统计现存探测记录。'].join('\n');
  const template=plainText(str(c.report_template));
  const values:Record<string,string>={event,event_code:code,message,start:localTime(start.toISOString(),c),end:localTime(end.toISOString(),c),
    latency:flags.ping?(totals.total?latencyText(totals.averageLatency):'无数据'):'',loss:flags.loss?lossText(totals.averageLoss):'',nodes:lines.join('\n\n'),count:String(totals.total)};
  return {event,code,emoji:'📊',time:new Date().toISOString(),metrics:metricKey(c),
    message:template?template.replace(/\{\{(\w+)\}\}/g,(m,k:string)=>values[k]??m):message};
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
  if (!bool(c[`${kind}_enabled`], false)||!metricKey(c)) return;
  const {start, end} = reportRange(kind, new Date(), number(c.custom_hours, 6, 0.05, 8760));
  const startText = start.toISOString(), endText = end.toISOString();
  if (state.reports[kind] === `${startText}/${endText}` || state.requests.some(r => r.kind === kind && r.start === startText && r.end === endText)) return;
  if (state.requests.length >= 100) throw new Error('Report request queue full; check metrics API');
  state.requests.push({kind, start:startText, end:endText, next:0, attempts:0}); save();
  await drainReports();
}
let lastTestSent=0,testSending=false;
function header(req:PluginRequest,name:string) {
  const key=Object.keys(req.headers).find(k=>k.toLowerCase()===name);const v=key?req.headers[key]:'';
  return Array.isArray(v)?v[0]:v||'';
}
function reply(res:PluginResponse,status:number,data:unknown) {
  res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(data));
}
function isAdmin(req:PluginRequest) {return req.context?.principal?.roles?.includes('admin')===true;}
async function simulation(c:Config,input:Record<string,unknown>):Promise<Event> {
  const type=str(input.type,'ping-failure');
  const allowed=['ping-failure','ping-recovery','loss-failure','loss-recovery','report'];
  if(!allowed.includes(type))throw new Error('请选择有效的模拟类型');
  if(type.startsWith('ping')&&!bool(c.enabled,true))throw new Error('请先开启探测检测，再模拟探测通知');
  if(type.startsWith('loss')&&!bool(c.loss_enabled,false))throw new Error('请先开启丢包率检测，再模拟丢包通知');
  const templates=input.templates&&typeof input.templates==='object'?input.templates as Record<string,unknown>:{};
  const config={...c};for(const k of ['failure_template','recovery_template','report_template']) {
    if(typeof templates[k]==='string') {if((templates[k] as string).length>8000)throw new Error('模板过长，最多 8000 字符');config[k]=templates[k];}
  }
  const selected=await scope(c),task=selected.tasks[0]||{id:0,name:'模拟任务',target:'example.com',clients:['simulation']};
  const uuid=task.clients?.[0]||'simulation',nodes=selected.nodes;
  const now=new Date(),r=rules(c);
  let event:Event;
  if(type==='report') {
    const payload=reportEvent(config,'custom',new Date(now.getTime()-3600000),now,[task],{...nodes,[uuid]:nodes[uuid]||{name:'模拟节点'}},
      [{entity_id:uuid,task_id:String(task.id),total:100,valid:100-number(input.loss,5,0,100),avg:number(input.latency,45,0,600000),loss:number(input.loss,5,0,100)}]);
    if(!payload)throw new Error('探测检测和丢包率检测均未开启，不生成报告');
    event=payload;
  } else event=alertEvent({rule:type.startsWith('loss')?'loss':'ping',recovered:type.endsWith('recovery'),time:now.toISOString(),
    count:type.startsWith('loss')?(type.endsWith('recovery')?r.lossRecoveryCount:r.lossFailureCount):(type.endsWith('recovery')?r.recoveryCount:r.failureCount),
    latency:number(input.latency,type.endsWith('recovery')?50:250,-1,600000),lossPercent:number(input.loss,type.endsWith('recovery')?0:25,0,100)},task,uuid,{...nodes,[uuid]:nodes[uuid]||{name:'模拟节点'}},config);
  const originalTitle=event.event;
  event.event=`【模拟】${originalTitle}`;
  event.message=`【模拟通知，不代表真实故障】\n${event.message.startsWith(originalTitle+'\n')?event.message.slice(originalTitle.length+1):event.message}`;
  if(!selected.nodes[uuid])event.clients=undefined;
  return event;
}
function registerTestRoutes() {
  server.route('GET','/api/plugins/ping-alert/test/context',async(req,res)=>{
    if(!isAdmin(req)){reply(res,403,{error:'仅管理员可访问'});return;}
    const c=await server.getConfig<Config>();reply(res,200,{ping:bool(c.enabled,true),loss:bool(c.loss_enabled,false),
      templates:{failure_template:str(c.failure_template),recovery_template:str(c.recovery_template),report_template:str(c.report_template)}});
  });
  for(const action of ['preview','send'])server.route('POST',`/api/plugins/ping-alert/test/${action}`,async(req,res)=>{
    if(!isAdmin(req)){reply(res,403,{error:'仅管理员可访问'});return;}
    if(header(req,'x-ping-alert-test')!=='1'||!header(req,'content-type').toLowerCase().startsWith('application/json')){reply(res,403,{error:'请求来源校验失败'});return;}
    const origin=header(req,'origin');
    // Go keeps Host outside Request.Header, so use browser-controlled Fetch Metadata instead.
    if(origin&&header(req,'sec-fetch-site')!=='same-origin'){reply(res,403,{error:'不允许跨站测试请求'});return;}
    if(req.body.length>32768){reply(res,413,{error:'请求内容过长'});return;}
    let ownsLock=false;
    try {
      const c=await server.getConfig<Config>(),payload=await simulation(c,JSON.parse(req.body)),prepared=await deliveryPreview(payload);
      if(action==='send') {
        if(testSending||Date.now()-lastTestSent<10000){reply(res,429,{error:'请间隔至少 10 秒再发送模拟通知'});return;}
        if(!prepared.ready){reply(res,400,{error:'请先开启 Komari 通知并选择通知渠道'});return;}
        testSending=true;ownsLock=true;
        // Deliberately bypass monitoring state, pending queues, and report schedule state.
        await server.call('admin:sendNotification',{event:prepared.payload});lastTestSent=Date.now();
      }
      reply(res,200,{preview:prepared.preview,raw:prepared.raw,channel:prepared.channel,ready:prepared.ready,sent:action==='send',
        note:'预览包含系统全局模板与 Telegram 标题；最终客户端字体及自动链接由通知渠道决定。测试失败不会自动重试。'});
    }catch(e){reply(res,400,{error:String(e instanceof Error?e.message:e)});}finally{if(ownsLock)testSending=false;}
  });
}
definePlugin({
  async load() {
    sessionStart = new Date().toISOString(); state = readState();
    for (const [key, old] of Object.entries(state.entries)) state.entries[key] = freshMonitor(sessionStart, old);
    save();
    registerTestRoutes();
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
