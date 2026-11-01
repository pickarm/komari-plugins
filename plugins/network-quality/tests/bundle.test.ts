import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

const encode = (value:string) => Buffer.from(value,'utf8').toString('base64');
function envelope(line="CN2GIA") {
  const csv = '网络,省份,运营商,IP版本,状态,发送,收到,丢包率(%),平均延迟ms,线路\nIPv4大包,上海,电信,IPv4,OK,30,30,0,128,'+line+'\n';
  return `安装日志\nNQ_RESULT:${encode(JSON.stringify({version:1,mode:'detect',preflight:{ok:true,errors:[],missing:[],details:{os:'Linux'}},raw:{routesCsvBase64:encode(csv),unlockJsonBase64:{'4':encode(JSON.stringify({Media:{Netflix:{Status:'解锁',Region:'US',Type:'原生'}}}))}},errors:[]}))}\n`;
}
async function harness(files=new Map<string,string>(),tasks:any[]=[]) {
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-01T02:00:00Z'));
  const routes=new Map<string,any>(),schedules=new Map<string,any>(),commands:string[]=[];
  const host={getConfig:async()=>({enabled:true,public_enabled:true}),route:(method:string,path:string,fn:any)=>routes.set(`${method} ${path}`,fn),cron:(expr:string,fn:any)=>schedules.set(expr,fn),call:async(method:string,args?:any)=>{
    if(method==='common:getNodes')return {a:{name:'测试节点',os:'Alpine Linux'},hidden:{name:'隐藏',hidden:true,os:'Linux'}};
    if(method==='common:getNodesLatestStatus')return {a:{online:true},hidden:{online:true}};
    if(method==='admin:exec'){commands.push(args.command);tasks.push({task_id:`t${tasks.length+1}`,command:args.command,results:[]});return {task_id:tasks.at(-1).task_id};}
    if(method==='admin:getTaskById')return tasks.find(task=>task.task_id===args.task_id);
    if(method==='admin:getTasksByClientId')return tasks;
    throw Error(method);
  }};
  const disk={existsSync:(path:string)=>files.has(path),mkdirSync:()=>{},readFileSync:(path:string)=>files.get(path),writeFileSync:(path:string,value:string)=>files.set(path,value),renameSync:(from:string,to:string)=>{files.set(to,files.get(from)!);files.delete(from);},unlinkSync:(path:string)=>files.delete(path)};
  const context=vm.createContext({__storageDir__:'/storage',Date,console:{error:()=>{},warn:()=>{}},require:(name:string)=>{if(name==='server')return host;if(name==='fs')return disk;throw Error(`Unexpected module ${name}`);}});
  vm.runInContext(fs.readFileSync('script.js','utf8'),context);await context.load();
  return {context,routes,schedules,commands,files,tasks,poll:()=>schedules.get('@every 15s')(),request:async(path:string,method='GET',body:any={},query:any={},admin=true)=>{
    let text='';const response:any={statusCode:200,setHeader:()=>{},end:(value:string)=>text=value};
    await routes.get(`${method} /api/plugins/network-quality/v1/${path}`)({context:{principal:{roles:admin?['admin']:[]}},query,body:JSON.stringify(body),headers:{'content-type':'application/json','x-network-quality':'1',origin:'https://komari.example','sec-fetch-site':'same-origin'}},response);
    return {status:response.statusCode,data:path==='raw'?text:JSON.parse(text)};
  }};
}
afterEach(()=>vi.useRealTimers());
describe('packaged Komari VM integration',()=>{
  it('loads without Node globals, dispatches only after an admin request, parses real engine envelope and exposes a read-only report',async()=>{
    const h=await harness();expect(vm.runInContext('typeof Buffer + ":" + typeof URL + ":" + typeof Intl',h.context)).toBe('undefined:undefined:object');
    expect(h.commands).toEqual([]);expect([...h.schedules.keys()]).toEqual(['@every 15s']);
    const queued=await h.request('start','POST',{uuids:['a']});expect(queued.status).toBe(202);expect(h.commands).toEqual([]);
    await h.poll();expect(h.commands).toHaveLength(1);expect(h.commands[0]).toContain('# KOMARI_NETWORK_QUALITY_JOB:');expect(h.commands[0]).toContain('--no-rank-upload');
    h.tasks[0].results=[{client:'a',result:envelope(),exit_code:0,finished_at:new Date().toISOString()}];await h.poll();
    const visible=await h.request('public','GET',{}, {uuid:'a'},false);expect(visible.data.latest.routes[0]).toMatchObject({province:'上海',line:'CN2GIA',latency:128,loss:0});expect(visible.data.latest.unlocks[0]).toMatchObject({service:'Netflix',region:'US',status:'available'});
    expect(visible.data.latest).not.toHaveProperty('taskId');expect(visible.data.latest).not.toHaveProperty('options');
    const raw=await h.request('raw','GET',{}, {uuid:'a',report_id:visible.data.latest.id});expect(raw.data).toContain('NQ_RESULT:');
    expect((await h.request('public','GET',{}, {uuid:'hidden'},false)).status).toBe(404);
    expect((await h.request('start','POST',{uuids:['a']},{},false)).status).toBe(403);
  });
  it('restarts from a persisted running task and never repeats the remote command',async()=>{
    const h=await harness();await h.request('start','POST',{uuids:['a']});await h.poll();
    const restarted=await harness(h.files,h.tasks);expect(restarted.commands).toHaveLength(0);
    h.tasks[0].results=[{client:'a',result:envelope(),exit_code:0,finished_at:new Date().toISOString()}];await restarted.poll();
    expect((await restarted.request('history','GET',{}, {uuid:'a'})).data.reports).toHaveLength(1);expect(restarted.commands).toHaveLength(0);
  });
});

it('archives route switches in the actual VM and keeps them after restart',async()=>{
  const h=await harness();await h.request('start','POST',{uuids:['a']});await h.poll();
  h.tasks[0].results=[{client:'a',result:envelope(),exit_code:0,finished_at:new Date().toISOString()}];await h.poll();
  vi.advanceTimersByTime(60000);await h.request('start','POST',{uuids:['a']});await h.poll();
  h.tasks[1].results=[{client:'a',result:envelope('163'),exit_code:0,finished_at:new Date().toISOString()}];await h.poll();
  const visible=await h.request('public','GET',{}, {uuid:'a'},false);
  expect(visible.data.latest.routeComparison).toMatchObject({compared:1,changes:[{before:'CN2GIA',after:'163'}]});
  const restarted=await harness(h.files,h.tasks);
  expect((await restarted.request('public','GET',{}, {uuid:'a'},false)).data.latest.routeComparison.changes).toHaveLength(1);
  expect(restarted.commands).toEqual([]);
});

it('uses persisted node module choices inside the actual VM and blocks disabled nodes',async()=>{
  const h=await harness();const ctx=await h.request('context');const config={...ctx.data.config,nodeModules:{a:['unlocks'],hidden:[]}};
  expect((await h.request('config','POST',{config})).status).toBe(200);
  const queued=await h.request('start','POST',{uuids:['a','hidden']});expect(queued.data.jobs[0].options.modules).toEqual(['unlocks']);expect(queued.data.skipped).toEqual(['hidden']);
  await h.poll();expect(h.commands).toHaveLength(1);
  const restarted=await harness(h.files,h.tasks);expect((await restarted.request('context')).data.config.nodeModules).toEqual({a:['unlocks'],hidden:[]});expect(restarted.commands).toEqual([]);
});
