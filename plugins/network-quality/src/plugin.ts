import { definePlugin, server, type PluginRequest, type PluginResponse } from '@komari-monitor/plugin-sdk';
import { defaultConfig, object, PROVINCES, validateConfig, validateOptions } from './config';
import { buildCommand, ENGINE_SOURCES } from './runner';
import { parseResult } from './parsers';
import { StateStore } from './store';
import { cronMatches, scheduleCron } from './schedules';
import type { DetectionOptions, Job, JobMode, NodeRecord, ParsedResult, PersistentState, PluginConfig, Report } from './types';

const BASE = '/api/plugins/network-quality/v1';
const active = (job: Job) => !job.completedAt;
const message = (error: unknown) => error instanceof Error ? error.message : String(error);
type Host = { call<T=unknown>(method:string,...params:unknown[]):Promise<T>; getConfig():Promise<Record<string,unknown>> };
type TaskResult = { client:string; result:string; exit_code:number|null; finished_at:string|null };
type CoreTask = { task_id:string; command?:string; results?:TaskResult[] };

/** The persistent dispatch marker is reconciled against Komari tasks after a crash.
 * A dispatch whose outcome is unknown is never automatically executed again. */
export class NetworkRuntime {
  state: PersistentState;
  private chain: Promise<unknown> = Promise.resolve();
  constructor(private readonly host: Host, readonly store: StateStore, private readonly now:()=>number = Date.now) {
    this.state = store.load(now());
    // Never catch up schedules missed while Komari was stopped.
    this.state.lastScheduleMinute = Math.floor(now()/60000); store.prune(this.state,now()); store.save(this.state);
  }
  exclusive<T>(fn:()=>Promise<T>):Promise<T> { const next = this.chain.then(fn); this.chain = next.catch(() => undefined); return next; }
  save() { this.store.save(this.state); }
  async effective() { const managed = await this.host.getConfig(); return { enabled: managed.enabled !== false && this.state.config.enabled, publicEnabled: managed.public_enabled !== false && this.state.config.publicEnabled }; }
  async nodes():Promise<Record<string,NodeRecord>> { return this.host.call<Record<string,NodeRecord>>('common:getNodes'); }
  async nodeList() {
    const nodes = await this.nodes();
    let status:Record<string,{online?:boolean}> = {};
    try { status = await this.host.call('common:getNodesLatestStatus'); } catch { /* The start path checks availability again at dispatch time. */ }
    return Object.entries(nodes).map(([uuid,node]) => ({uuid,name:node.name || uuid,hidden:node.hidden === true,online:status[uuid]?.online === true}));
  }
  async configure(input:unknown):Promise<PluginConfig> {
    const config = validateConfig(input), nodes = await this.nodes();
    if (Object.keys(config.schedules).some(uuid => !nodes[uuid])) throw new Error('定时配置包含不存在的节点');
    this.state.config = config; this.state.lastScheduleMinute = Math.floor(this.now()/60000);
    this.store.prune(this.state,this.now()); this.save(); return config;
  }
  private add(uuid:string,mode:JobMode,options:DetectionOptions,source:Job['source']):Job {
    const id = `nq_${this.now().toString(36)}_${Math.random().toString(36).slice(2,12)}`;
    const job:Job = {id,uuid,mode,options,source,status:'queued',createdAt:new Date(this.now()).toISOString(),errors:[]};
    this.state.jobs.push(job); return job;
  }
  async enqueue(input:unknown):Promise<Job[]> {
    if (!(await this.effective()).enabled) throw new Error('网络检测总开关已关闭');
    const data = object(input,'检测请求');
    if(Object.keys(data).some(key => !['uuids','mode','options'].includes(key))) throw new Error('检测请求含有不支持的字段');
    if (!Array.isArray(data.uuids) || !data.uuids.length || data.uuids.length > 100 || data.uuids.some(uuid => typeof uuid !== 'string')) throw new Error('请选择 1–100 个节点');
    const uuids = [...new Set(data.uuids)] as string[], mode = data.mode ?? 'detect';
    if (!['detect','preflight','prepare'].includes(String(mode))) throw new Error('检测操作不正确');
    const options = validateOptions(data.options ?? {},this.state.config.defaults), nodes = await this.nodes();
    for (const uuid of uuids) {
      if (!nodes[uuid]) throw new Error('所选节点不存在');
      if (this.state.jobs.some(job => job.uuid === uuid && active(job))) throw new Error(`节点 ${nodes[uuid].name || uuid} 已有排队或运行中的任务`);
    }
    const jobs = uuids.map(uuid => this.add(uuid,mode as JobMode,options,'manual')); this.save(); return jobs;
  }
  private finishFailure(job:Job,error:string,status:Job['status']='failed') {
    job.errors.push(error); job.status=status; job.completedAt=new Date(this.now()).toISOString();
    if(job.mode==='detect') this.state.reports.unshift({id:job.id,uuid:job.uuid,startedAt:job.startedAt || job.createdAt,completedAt:job.completedAt,status:'failed',ipv:job.options.ipv,routes:[],unlocks:[],errors:[...job.errors],options:job.options,taskId:job.taskId,engines:job.engines});
    this.save();
  }
  private finishResult(job:Job,result:TaskResult) {
    let parsed: ParsedResult;
    if(job.mode==='detect') this.store.saveRaw(job.id,result.result);
    try { parsed = parseResult(result.result) as ParsedResult; }
    catch(error) { this.finishFailure(job,`结果解析失败：${message(error)}`); return; }
    job.preflight = parsed.preflight;
    const errors = [...new Set([...(parsed.errors || []),...(parsed.preflight?.ok === false ? parsed.preflight.errors : [])])];
    const good = parsed.routes.some(route => route.status === 'ok' || route.status === 'no-response') || parsed.unlocks.some(unlock => unlock.status === 'available' || unlock.status === 'restricted');
    const usable = parsed.routes.length + parsed.unlocks.length > 0;
    const missingModule = job.mode==='detect' && (job.options.modules.includes('routes') && !parsed.routes.length || job.options.modules.includes('unlocks') && !parsed.unlocks.length);
    const degraded = errors.length > 0 || result.exit_code !== 0 || missingModule || parsed.routes.some(route => route.status === 'failed' || route.status === 'unsupported') || parsed.unlocks.some(unlock => unlock.status === 'unknown' || unlock.status === 'unsupported');
    job.status = job.mode==='detect' ? usable ? degraded ? 'partial' : 'succeeded' : 'failed' : parsed.preflight?.ok === true && result.exit_code === 0 ? 'succeeded' : 'failed';
    // Environment/parse failures are retained for diagnosis but do not replace the last good public report.
    // A measured no-response is useful network data; lack of raw-socket permission is not.
    if(job.mode==='detect' && usable && !good && degraded) job.status='failed';
    if(missingModule) errors.push('部分检测模块没有返回数据');
    if(!usable && job.mode==='detect') errors.push('未返回可用检测结果');
    if(result.exit_code !== 0 && !errors.length) errors.push(`远程检测退出码：${result.exit_code}`);
    job.errors = [...new Set(errors)]; job.completedAt = result.finished_at && Number.isFinite(Date.parse(result.finished_at)) ? result.finished_at : new Date(this.now()).toISOString();
    if(job.mode==='detect') this.state.reports.unshift({id:job.id,uuid:job.uuid,startedAt:job.startedAt || job.createdAt,completedAt:job.completedAt,status:job.status as Report['status'],ipv:job.options.ipv,routes:parsed.routes,unlocks:parsed.unlocks,errors:job.errors,options:job.options,taskId:job.taskId,engines:job.engines});
    this.store.prune(this.state,this.now()); this.save();
  }
  private async collect(job:Job) {
    const started = Date.parse(job.startedAt || job.createdAt);
    // Give the Agent time to upload the timeout result after the wrapper's hard deadline.
    if(this.now() > started + job.options.timeoutMinutes * 60000 + 120000) { this.finishFailure(job,'检测超时，未收到完整结果','timed-out'); return; }
    try {
      if(!job.taskId) {
        const tasks = await this.host.call<CoreTask[]>('admin:getTasksByClientId',{uuid:job.uuid});
        const found = tasks.filter(task => task.command?.startsWith(`# KOMARI_NETWORK_QUALITY_JOB:${job.id}\n`));
        if(found.length === 1) { job.taskId=found[0].task_id; job.status='running'; this.save(); }
        else { job.status='uncertain'; this.save(); return; }
      }
      const task = await this.host.call<CoreTask>('admin:getTaskById',{task_id:job.taskId});
      const result = task.results?.find(value => value.client===job.uuid && value.finished_at && value.exit_code!==null);
      if(result) this.finishResult(job,result);
    } catch(error) { console.warn('network-quality: waiting for task %s: %s',job.id,message(error)); }
  }
  private async dispatch(job:Job) {
    try {
      const nodes=await this.nodes(),node=nodes[job.uuid];
      if(!node) { this.finishFailure(job,'节点已删除，未下发检测'); return; }
      const os=typeof node.os==='string'?node.os.trim():'';
      if(os && !/linux|ubuntu|debian|centos|alpine|fedora|rocky|alma|arch|opensuse|suse|rhel|red hat|openwrt|oracle|nixos|gentoo|amazon|raspbian/i.test(os)) { this.finishFailure(job,'当前检测脚本仅支持 Linux 节点，未下发检测'); return; }
      const latest=await this.host.call<Record<string,{online?:boolean}>>('common:getNodesLatestStatus');
      if(latest[job.uuid]?.online!==true) { this.finishFailure(job,'节点当前离线，未下发检测'); return; }
    } catch(error) { this.finishFailure(job,`节点状态检查失败，未下发检测：${message(error)}`); return; }
    job.status='dispatching'; job.startedAt=new Date(this.now()).toISOString();
    job.engines={TcpQuality:ENGINE_SOURCES.tcp.commit,IPQuality:ENGINE_SOURCES.ip.commit}; this.save();
    let command: string;
    try { command = `# KOMARI_NETWORK_QUALITY_JOB:${job.id}\n${buildCommand(job.id,job.options,job.mode)}`; }
    catch(error) { this.finishFailure(job,message(error)); return; }
    try {
      const task = await this.host.call<{task_id:string}>('admin:exec',{command,clients:[job.uuid]});
      if(!task.task_id) throw new Error('Komari 未返回远程任务标识');
      job.taskId=task.task_id; job.status='running'; this.save();
    } catch(error) {
      // An RPC error can occur after Komari created the task. Reconcile rather than retry.
      job.status='uncertain'; job.errors=[`下发结果待核实：${message(error)}`]; this.save();
    }
  }
  async tick():Promise<void> {
    const enabled = (await this.effective()).enabled;
    const running = this.state.jobs.find(job => active(job) && job.status!=='queued');
    if(running) await this.collect(running);
    const minute = Math.floor(this.now()/60000);
    if(minute !== this.state.lastScheduleMinute) {
      this.state.lastScheduleMinute=minute;
      if(enabled) {
        const nodes=await this.nodes();
        for(const [uuid,schedule] of Object.entries(this.state.config.schedules)) {
          if(schedule.enabled && nodes[uuid] && cronMatches(scheduleCron(schedule),this.now()) && !this.state.jobs.some(job=>job.uuid===uuid && (active(job) || job.source==='schedule' && Math.floor(Date.parse(job.createdAt)/60000)===minute))) this.add(uuid,'detect',validateOptions(schedule.options || {},this.state.config.defaults),'schedule');
        }
      }
      this.store.prune(this.state,this.now()); this.save();
    }
    if(enabled && !this.state.jobs.some(job=>active(job)&&job.status!=='queued')) {
      const queued=this.state.jobs.find(job=>active(job)&&job.status==='queued');
      if(queued) await this.dispatch(queued);
    }
  }
  history(uuid:string) { return this.state.reports.filter(report=>report.uuid===uuid); }
}

function header(req:PluginRequest,name:string):string { const found=Object.entries(req.headers).find(([key])=>key.toLowerCase()===name)?.[1]; return Array.isArray(found)?found[0] || '':found || ''; }
function isAdmin(req:PluginRequest) { return req.context?.principal?.roles?.includes('admin')===true; }
function reply(res:PluginResponse,status:number,data:unknown) { res.statusCode=status; res.setHeader('Content-Type','application/json; charset=utf-8'); res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff'); res.end(JSON.stringify(data)); }
function privateText(value:string):string { return String(value).replace(/\[?(?:[a-fA-F0-9]{0,4}:){2,}[a-fA-F0-9:.]{0,39}(?:%[a-zA-Z0-9_.-]+)?\]?/g,'[IP已隐藏]').replace(/(?:\d{1,3}\.){3}\d{1,3}/g,'[IP已隐藏]').slice(0,300); }
export function publicReport(report:Report) {
  return {id:report.id,uuid:report.uuid,startedAt:report.startedAt,completedAt:report.completedAt,status:report.status,ipv:report.ipv,
    routes:report.routes.map(route=>({province:privateText(route.province),carrier:route.carrier,family:route.family,...(route.packetType?{packetType:route.packetType}:{}),line:route.line?privateText(route.line):null,latency:route.latency,loss:route.loss,sent:route.sent,received:route.received,status:route.status})),
    unlocks:report.unlocks.map(unlock=>({service:privateText(unlock.service),family:unlock.family,status:unlock.status,region:unlock.region?privateText(unlock.region):null,detail:unlock.detail?privateText(unlock.detail):null})),errors:report.errors.length?['部分检测未完成，详情请管理员查看原始报告']:[]};
}
export function registerRoutes(runtime:NetworkRuntime) {
  const route=(method:string,path:string,handler:(req:PluginRequest,res:PluginResponse)=>Promise<void>)=>server.route(method,`${BASE}/${path}`,async(req,res)=>{
    if(path!=='public' && !isAdmin(req)) {reply(res,403,{error:'仅管理员可访问'});return;}
    if(method==='POST') {
      if(header(req,'x-network-quality')!=='1' || !header(req,'content-type').toLowerCase().startsWith('application/json') || header(req,'origin') && header(req,'sec-fetch-site')!=='same-origin') {reply(res,403,{error:'请求来源校验失败'});return;}
      if(req.body.length>65536){reply(res,413,{error:'请求内容过长'});return;}
    }
    try {await runtime.exclusive(()=>handler(req,res));} catch(error) {reply(res,400,{error:message(error)});}
  });
  route('GET','context',async(_req,res)=>reply(res,200,{version:1,config:runtime.state.config,effective:await runtime.effective(),defaults:defaultConfig(),nodes:await runtime.nodeList(),jobs:runtime.state.jobs,provinces:PROVINCES}));
  route('POST','config',async(req,res)=>{const data=object(JSON.parse(req.body),'请求');reply(res,200,{config:await runtime.configure(data.config)});});
  route('POST','start',async(req,res)=>{const jobs=await runtime.enqueue(JSON.parse(req.body));reply(res,202,{jobs});});
  route('GET','jobs',async(req,res)=>reply(res,200,{jobs:runtime.state.jobs.filter(job=>!req.query.uuid || job.uuid===req.query.uuid)}));
  route('GET','history',async(req,res)=>reply(res,200,{reports:runtime.history(req.query.uuid || '')}));
  route('GET','raw',async(req,res)=>{
    const report=runtime.history(req.query.uuid || '').find(item=>item.id===req.query.report_id);
    if(!report){reply(res,404,{error:'报告不存在或已过期'});return;}
    res.statusCode=200;res.setHeader('Content-Type','text/plain; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Disposition',`attachment; filename="network-quality-${report.id}.txt"`);res.end(runtime.store.readRaw(report.id));
  });
  route('GET','public',async(req,res)=>{
    const uuid=req.query.uuid || '',nodes=await runtime.nodes(),node=nodes[uuid];
    if(!node || node.hidden===true){reply(res,404,{error:'节点不存在'});return;}
    const effective=await runtime.effective();
    if(!effective.enabled || !effective.publicEnabled){reply(res,200,{version:1,enabled:false});return;}
    const reports=runtime.history(uuid),requested=req.query.report_id;
    const latest=requested?reports.find(report=>report.id===requested):reports.find(report=>report.status!=='failed') || reports[0];
    if(requested && !latest){reply(res,404,{error:'报告不存在或已过期'});return;}
    reply(res,200,{version:1,enabled:true,node:{uuid,name:node.name || uuid},reports:reports.map(report=>({id:report.id,completedAt:report.completedAt,status:report.status})),latest:latest?publicReport(latest):null});
  });
}

definePlugin({async load(){
  const runtime=new NetworkRuntime(server,new StateStore(__storageDir__)); registerRoutes(runtime);
  server.cron('@every 15s',()=>runtime.exclusive(()=>runtime.tick()).catch(error=>console.error('network-quality: %s',message(error))));
  await runtime.exclusive(()=>runtime.tick());
}});
