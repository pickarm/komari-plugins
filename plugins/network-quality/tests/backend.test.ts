import { beforeEach, describe, expect, it, vi } from 'vitest';
const routeRegistry = new Map<string,any>();
vi.mock('@komari-monitor/plugin-sdk',()=>({definePlugin:()=>{},server:{route:(method:string,path:string,handler:any)=>routeRegistry.set(`${method} ${path}`,handler)}}));
vi.mock('../src/runner',()=>({buildCommand:(id:string)=>`echo ${id}`,ENGINE_SOURCES:{tcp:{commit:'tcp-fixture'},ip:{commit:'ip-fixture'}}}));
vi.mock('../src/parsers',()=>({parseResult:(raw:string)=>JSON.parse(raw)}));
import { NetworkRuntime, publicReport, registerRoutes } from '../src/plugin';
import { StateStore } from '../src/store';
import { defaultConfig, validateConfig, validateOptions } from '../src/config';
import { cronMatches, validateCron } from '../src/schedules';

function disk() {
  const files = new Map<string,string>();
  return {files,fs:{existsSync:(path:string)=>files.has(path),mkdirSync:()=>{},readFileSync:(path:string)=>files.get(path)!,writeFileSync:(path:string,value:string)=>files.set(path,value),renameSync:(from:string,to:string)=>{files.set(to,files.get(from)!);files.delete(from);},unlinkSync:(path:string)=>files.delete(path)}};
}
function harness() {
  let time=Date.parse('2026-11-01T19:59:45Z'); const storage=disk();
  const tasks: any[] = []; let calls=0,dispatchError=false;
  const nodes:any={a:{name:'甲节点'},b:{name:'乙节点'},hidden:{name:'隐藏节点',hidden:true}};
  const host:any={getConfig:async()=>({}),call:async(method:string,args?:any)=>{
    if(method==='common:getNodes')return nodes;
    if(method==='common:getNodesLatestStatus')return {a:{online:true},b:{online:true},hidden:{online:true}};
    if(method==='admin:exec') { calls++;const task={task_id:`t${calls}`,command:args.command,results:[]};tasks.push(task);if(dispatchError)throw Error('连接中断');return {task_id:task.task_id}; }
    if(method==='admin:getTaskById')return tasks.find(task=>task.task_id===args.task_id);
    if(method==='admin:getTasksByClientId')return tasks;
    throw Error(method);
  }};
  const store=new StateStore('/storage',storage.fs); const create=()=>new NetworkRuntime(host,store,()=>time);
  const runtime=create();
  return {runtime,store,storage,host,tasks,nodes,create,get calls(){return calls;},set dispatchError(value:boolean){dispatchError=value;},advance:(amount=15000)=>time+=amount,now:()=>time};
}
const okResult=()=>({version:1,preflight:{ok:true,errors:[],missing:[],details:{}},routes:[{province:'上海',carrier:'电信',family:4,line:'CN2GIA',latency:128,loss:0,sent:30,received:30,status:'ok'}],unlocks:[{service:'Netflix',family:4,status:'available',region:'US',detail:null}],errors:[]});
function finish(h:ReturnType<typeof harness>,data:any=okResult()) { h.tasks.at(-1).results=[{client:'a',result:JSON.stringify(data),exit_code:0,finished_at:new Date(h.now()).toISOString()}]; }
async function request(runtime:NetworkRuntime,path:string,{method='GET',admin=true,body={},query={},headers={}}:any={}) {
  routeRegistry.clear();registerRoutes(runtime);let output='',status=200;const response:any={get statusCode(){return status;},set statusCode(value:number){status=value;},setHeader:()=>{},end:(value:string)=>output=value};
  await routeRegistry.get(`${method} /api/plugins/network-quality/v1/${path}`)({context:{principal:{roles:admin?['admin']:[]}},query,headers:{'content-type':'application/json','x-network-quality':'1',origin:'https://komari.example','sec-fetch-site':'same-origin',...headers},body:JSON.stringify(body)},response);
  return {status,body:path!=='raw' && output.startsWith('{')?JSON.parse(output):output};
}

beforeEach(()=>routeRegistry.clear());
describe('configuration and Beijing schedules',()=>{
  it('ships with schedules off and the promised probe defaults',()=>{
    const config=defaultConfig();expect(config.schedules).toEqual({});expect(config.defaults).toMatchObject({modules:['routes','unlocks'],count:30,parallel:4,timeoutMinutes:30,ipv:'4'});expect(config.defaults.provinces).toHaveLength(31);
  });
  it('rejects command and province injection, invalid types and unsupported cron syntax',()=>{
    expect(()=>validateOptions({command:'id'})).toThrow();expect(()=>validateOptions({provinces:['sh;id']})).toThrow();expect(()=>validateOptions({ipv:4})).toThrow();expect(()=>validateOptions({count:0})).toThrow();expect(()=>validateCron('0 4 * * * && id')).toThrow();expect(()=>validateCron('*/0 * * * *')).toThrow();
  });
  it('matches Beijing time independently of the host and implements day/weekday OR semantics',()=>{
    expect(cronMatches('0 4 * * *',Date.parse('2026-11-01T20:00:00Z'))).toBe(true);
    expect(cronMatches('0 4 * * *',Date.parse('2026-11-01T04:00:00Z'))).toBe(false);
    expect(cronMatches('0 4 1 * 1',Date.parse('2026-11-01T20:00:00Z'))).toBe(true);
  });
  it('rejects prototype keys when importing schedules',()=>{
    const config=defaultConfig();config.schedules=JSON.parse('{"__proto__":{}}');expect(()=>validateConfig(config)).toThrow();
  });
});
describe('persistent dispatch and result collection',()=>{
  it('serializes nodes globally and rejects per-node overlap',async()=>{
    const h=harness();await h.runtime.enqueue({uuids:['a','b']});await expect(h.runtime.enqueue({uuids:['a']})).rejects.toThrow('已有');
    await h.runtime.tick();expect(h.calls).toBe(1);await h.runtime.tick();expect(h.calls).toBe(1);
    finish(h);await h.runtime.tick();expect(h.calls).toBe(2);expect(h.runtime.history('a')[0].status).toBe('succeeded');
  });
  it('recovers an existing task after restart without re-executing it',async()=>{
    const h=harness();await h.runtime.enqueue({uuids:['a']});await h.runtime.tick();const restarted=h.create();finish(h);await restarted.tick();
    expect(h.calls).toBe(1);expect(restarted.history('a')).toHaveLength(1);expect(restarted.state.jobs[0].status).toBe('succeeded');
  });
  it('reconciles a dispatch whose RPC failed after Komari created the task',async()=>{
    const h=harness();h.dispatchError=true;await h.runtime.enqueue({uuids:['a']});await h.runtime.tick();expect(h.runtime.state.jobs[0].status).toBe('uncertain');
    h.dispatchError=false;const restarted=h.create();finish(h);await restarted.tick();expect(h.calls).toBe(1);expect(restarted.history('a')[0].taskId).toBe('t1');
  });
  it('times out an unresolved job without re-dispatching it',async()=>{
    const h=harness();await h.runtime.enqueue({uuids:['a']});await h.runtime.tick();h.advance(33*60000);await h.runtime.tick();
    expect(h.calls).toBe(1);expect(h.runtime.state.jobs[0].status).toBe('timed-out');expect(h.runtime.history('a')[0].status).toBe('failed');
  });
  it('keeps successful modules in a partial report and retains the previous successful report',async()=>{
    const h=harness();await h.runtime.enqueue({uuids:['a']});await h.runtime.tick();finish(h);await h.runtime.tick();
    h.advance();await h.runtime.enqueue({uuids:['a']});await h.runtime.tick();const parsed=okResult();parsed.unlocks=[];parsed.errors=['解锁超时'];finish(h,parsed);await h.runtime.tick();
    expect(h.runtime.history('a').map(report=>report.status)).toEqual(['partial','succeeded']);expect(h.runtime.history('a')[0].routes).toHaveLength(1);
  });
  it('runs preflight through the same queue without creating a public report',async()=>{
    const h=harness();await h.runtime.enqueue({uuids:['a'],mode:'preflight'});await h.runtime.tick();finish(h,{version:1,routes:[],unlocks:[],errors:[],preflight:{ok:false,errors:['缺少依赖'],missing:['bash'],details:{}}});await h.runtime.tick();
    expect(h.runtime.state.jobs[0]).toMatchObject({status:'failed',preflight:{missing:['bash']}});expect(h.runtime.history('a')).toEqual([]);
  });
  it('does not dispatch deleted, offline or unsupported nodes and frees the queue',async()=>{
    const h=harness();await h.runtime.enqueue({uuids:['a','b']});delete h.nodes.a;await h.runtime.tick();expect(h.calls).toBe(0);expect(h.runtime.state.jobs[0].errors[0]).toContain('已删除');
    h.nodes.b.os='Windows Server 2025';await h.runtime.tick();expect(h.calls).toBe(0);expect(h.runtime.state.jobs[1].errors[0]).toContain('Linux');
    h.nodes.a={name:'甲节点'};await h.runtime.enqueue({uuids:['a']});const original=h.host.call;
    h.host.call=async(method:string,args?:any)=>method==='common:getNodesLatestStatus'?{a:{online:false}}:original(method,args);
    await h.runtime.tick();expect(h.calls).toBe(0);expect(h.runtime.state.jobs[2].errors[0]).toContain('离线');
  });
});
describe('schedule execution and retention',()=>{
  const scheduled=()=>({...defaultConfig(),schedules:{a:{enabled:true,kind:'daily' as const,time:'04:00',weekday:0,cron:'0 4 * * *'}}});
  it('fires once per local minute and queues nodes instead of overlapping',async()=>{
    const h=harness();await h.runtime.configure(scheduled());h.advance();await h.runtime.tick();await h.runtime.tick();
    expect(h.runtime.state.jobs).toHaveLength(1);expect(h.runtime.state.jobs[0].source).toBe('schedule');expect(h.calls).toBe(1);
  });
  it('does not replay a schedule missed while stopped or run immediately on installation',async()=>{
    const h=harness();await h.runtime.configure(scheduled());h.advance(6*3600000);const restarted=h.create();await restarted.tick();expect(h.calls).toBe(0);expect(restarted.state.jobs).toEqual([]);
  });
  it('does not repeat a completed scheduled slot after the system clock moves backward',async()=>{
    const h=harness();await h.runtime.configure(scheduled());h.advance();await h.runtime.tick();finish(h);await h.runtime.tick();
    h.advance(-60000);await h.runtime.tick();h.advance(60000);await h.runtime.tick();expect(h.calls).toBe(1);expect(h.runtime.state.jobs).toHaveLength(1);
  });
  it('prunes both report summaries and their raw output while preserving an active job',async()=>{
    const h=harness();await h.runtime.enqueue({uuids:['a']});await h.runtime.tick();finish(h);await h.runtime.tick();const first=h.runtime.history('a')[0].id;
    h.advance();await h.runtime.enqueue({uuids:['a']});await h.runtime.tick();finish(h);await h.runtime.tick();
    await h.runtime.configure({...defaultConfig(),maxReportsPerNode:1});expect(h.runtime.history('a')).toHaveLength(1);expect(h.storage.files.has(`/storage/raw-${first}.txt`)).toBe(false);
  });
  it('expires old reports by age and preserves pending work',async()=>{
    const h=harness();await h.runtime.enqueue({uuids:['a']});await h.runtime.tick();finish(h);await h.runtime.tick();const first=h.runtime.history('a')[0].id;
    h.advance(91*86400000);await h.runtime.enqueue({uuids:['b']});await h.runtime.configure(defaultConfig());expect(h.runtime.history('a')).toEqual([]);expect(h.storage.files.has(`/storage/raw-${first}.txt`)).toBe(false);expect(h.runtime.state.jobs).toHaveLength(1);expect(h.runtime.state.jobs[0].uuid).toBe('b');
  });
});
describe('HTTP permission boundaries',()=>{
  it('rejects anonymous mutations and cross-origin form requests before any remote action',async()=>{
    const h=harness();expect((await request(h.runtime,'start',{method:'POST',admin:false,body:{uuids:['a']}})).status).toBe(403);
    expect((await request(h.runtime,'start',{method:'POST',body:{uuids:['a']},headers:{'sec-fetch-site':'cross-site'}})).status).toBe(403);
    expect((await request(h.runtime,'start',{method:'POST',body:{uuids:['a']},headers:{'x-network-quality':''}})).status).toBe(403);expect(h.calls).toBe(0);
  });
  it('hides hidden nodes and raw downloads from visitors',async()=>{
    const h=harness();expect((await request(h.runtime,'public',{admin:false,query:{uuid:'hidden'}})).status).toBe(404);
    expect((await request(h.runtime,'raw',{admin:false,query:{uuid:'a',report_id:'../../state-v1'}})).status).toBe(403);
    expect((await request(h.runtime,'public',{admin:false,query:{uuid:'a'}})).body).toMatchObject({version:1,enabled:true,latest:null});
  });
  it('returns a read-only public snapshot, masks IPs and never leaks raw output or task identifiers',async()=>{
    const h=harness();await h.runtime.enqueue({uuids:['a']});await h.runtime.tick();const parsed=okResult();parsed.routes[0].line='CN2GIA 1.2.3.4 2001:db8::1';finish(h,parsed);await h.runtime.tick();
    const result=await request(h.runtime,'public',{admin:false,query:{uuid:'a'}}),serialized=JSON.stringify(result.body);
    expect(serialized).not.toContain('1.2.3.4');expect(serialized).not.toContain('2001:db8');expect(serialized).not.toContain('taskId');expect(serialized).not.toContain('command');expect(h.calls).toBe(1);
    const raw=await request(h.runtime,'raw',{query:{uuid:'a',report_id:h.runtime.history('a')[0].id}});expect(raw.body).toContain('1.2.3.4');
  });
  it('does not overwrite the last good public result when the newest detection failed',async()=>{
    const h=harness();await h.runtime.enqueue({uuids:['a']});await h.runtime.tick();finish(h);await h.runtime.tick();const good=h.runtime.history('a')[0].id;
    h.advance();await h.runtime.enqueue({uuids:['a']});await h.runtime.tick();finish(h,{version:1,routes:[],unlocks:[],errors:['failure']});await h.runtime.tick();
    const result=await request(h.runtime,'public',{admin:false,query:{uuid:'a'}});expect(result.body.latest.id).toBe(good);expect(result.body.reports).toHaveLength(2);
  });
  it('respects both local and Komari managed public switches',async()=>{
    const h=harness();h.host.getConfig=async()=>({public_enabled:false});expect((await request(h.runtime,'public',{admin:false,query:{uuid:'a'}})).body).toEqual({version:1,enabled:false});
  });
  it('masks bracketed, scoped, compressed and IPv4-mapped IPv6 addresses',()=>{
    const record:any={id:'r',uuid:'a',startedAt:'now',completedAt:'now',status:'succeeded',ipv:'both',errors:[],unlocks:[],routes:[]};
    for(const ip of ['[2001:db8::1]','fe80::abcd%eth0','::1','::ffff:192.0.2.1']) {
      record.routes=[{...okResult().routes[0],line:`CN2GIA ${ip}`}];const output=JSON.stringify(publicReport(record));expect(output).not.toContain(ip);expect(output).toContain('CN2GIA');
    }
  });
});

describe('route change persistence and privacy',()=>{
  it('persists detected changes through restart and retention pruning, with sanitized public fields',async()=>{
    const h=harness();await h.runtime.enqueue({uuids:['a']});await h.runtime.tick();finish(h);await h.runtime.tick();
    h.advance();await h.runtime.enqueue({uuids:['a']});await h.runtime.tick();const changed=okResult();changed.routes[0].line='163 1.2.3.4';finish(h,changed);await h.runtime.tick();
    expect(h.runtime.history('a')[0].routeComparison?.changes[0]).toMatchObject({before:'CN2GIA',after:'163 1.2.3.4'});
    await h.runtime.configure({...defaultConfig(),maxReportsPerNode:1});const restarted=h.create();
    expect(restarted.history('a')).toHaveLength(1);
    const result=await request(restarted,'public',{query:{uuid:'a'},admin:false});
    expect(result.body.latest.routeComparison.changes[0].after).toBe('163 [IP已隐藏]');
    expect(JSON.stringify(result.body)).not.toContain('1.2.3.4');
    expect((await request(restarted,'public',{query:{uuid:'hidden'},admin:false})).status).toBe(404);
  });
});

describe('per-node detection modules',()=>{
  it('defaults to both checked and accepts legacy configs without node overrides',()=>{
    const config=defaultConfig();expect(config.defaults.modules).toEqual(['routes','unlocks']);expect(config.nodeModules).toEqual({});
    const {nodeModules:_,...legacy}=config;expect(validateConfig(legacy).nodeModules).toEqual({});
    expect(validateConfig({...config,nodeModules:{a:[]}}).nodeModules.a).toEqual([]);
    expect(()=>validateConfig({...config,nodeModules:{a:['id;sh']}})).toThrow('项目');
    expect(()=>validateConfig({...config,nodeModules:JSON.parse('{"__proto__":[]}')})).toThrow('标识');
  });
  it('persists independent modules and applies them to manual, preflight and prepare requests',async()=>{
    for(const mode of ['detect','preflight','prepare']){
      const h=harness();await h.runtime.configure({...defaultConfig(),nodeModules:{a:['unlocks'],b:['routes']}});
      const restarted=h.create(),jobs=await restarted.enqueue({uuids:['a','b'],mode});
      expect(jobs.map(job=>job.options.modules)).toEqual([['unlocks'],['routes']]);
      expect(restarted.state.config.nodeModules).toEqual({a:['unlocks'],b:['routes']});
    }
  });
  it('cannot re-enable a node-disabled module through request options and skips only disabled nodes in a batch',async()=>{
    const h=harness();await h.runtime.configure({...defaultConfig(),nodeModules:{a:['unlocks'],b:[]}});
    const response=await request(h.runtime,'start',{method:'POST',body:{uuids:['a','b'],options:{modules:['routes','unlocks']}}});
    expect(response.status).toBe(202);expect(response.body.jobs[0].options.modules).toEqual(['unlocks']);expect(response.body.skipped).toEqual(['b']);
    await expect(h.runtime.enqueue({uuids:['b']})).rejects.toThrow('均未启用');expect(h.runtime.state.jobs).toHaveLength(1);
    expect(h.calls).toBe(0);
  });
  it('uses defaults until a node is explicitly set, and rejects unknown nodes',async()=>{
    const h=harness(),config=defaultConfig();config.defaults.modules=['routes'];config.nodeModules={b:['unlocks']};await h.runtime.configure(config);
    expect((await h.runtime.enqueue({uuids:['a','b']})).map(job=>job.options.modules)).toEqual([['routes'],['unlocks']]);
    await expect(h.runtime.configure({...defaultConfig(),nodeModules:{nonexistent:['routes']}})).rejects.toThrow('不存在');
  });
  it('uses node choices for schedules, skips disabled nodes, and never enables a schedule by selecting modules',async()=>{
    const h=harness();await h.runtime.configure({...defaultConfig(),nodeModules:{a:['unlocks']}});h.advance();await h.runtime.tick();expect(h.calls).toBe(0);
    const plan={enabled:true,kind:'daily' as const,time:'04:00',weekday:0,cron:'0 4 * * *'};
    const second=harness();await second.runtime.configure({...defaultConfig(),nodeModules:{a:['unlocks'],b:['routes'],hidden:[]},schedules:{a:plan,b:plan,hidden:plan}});
    second.advance();await second.runtime.tick();expect(second.runtime.state.jobs.map(job=>[job.uuid,job.options.modules])).toEqual([['a',['unlocks']],['b',['routes']]]);expect(second.calls).toBe(1);
  });
  it('rechecks disabled modules before dispatch and does not turn an intentionally skipped task into a failure report',async()=>{
    const h=harness();await h.runtime.enqueue({uuids:['a']});await h.runtime.configure({...defaultConfig(),nodeModules:{a:[]}});await h.runtime.tick();
    expect(h.calls).toBe(0);expect(h.runtime.state.jobs[0].status).toBe('skipped');expect(h.runtime.history('a')).toEqual([]);
    const second=harness();await second.runtime.enqueue({uuids:['a']});await second.runtime.configure({...defaultConfig(),nodeModules:{a:['unlocks']}});await second.runtime.tick();
    expect(second.runtime.state.jobs[0].options.modules).toEqual(['unlocks']);expect(second.calls).toBe(1);
  });
  it('keeps running jobs intact and only archives results from the selected modules',async()=>{
    const h=harness();await h.runtime.configure({...defaultConfig(),nodeModules:{a:['routes']}});await h.runtime.enqueue({uuids:['a']});await h.runtime.tick();
    await h.runtime.configure({...defaultConfig(),nodeModules:{a:[]}});finish(h);await h.runtime.tick();
    expect(h.runtime.history('a')[0].routes).toHaveLength(1);expect(h.runtime.history('a')[0].unlocks).toEqual([]);expect(h.runtime.history('a')[0].status).toBe('succeeded');expect(h.calls).toBe(1);
  });
  it('prevents anonymous node-setting changes',async()=>{
    const h=harness();const result=await request(h.runtime,'config',{method:'POST',admin:false,body:{config:{...defaultConfig(),nodeModules:{a:[]}}}});
    expect(result.status).toBe(403);expect(h.runtime.state.config.nodeModules).toEqual({});
  });
});
