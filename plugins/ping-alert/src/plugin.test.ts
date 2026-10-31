import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
const script = () => fs.readFileSync('script.js', 'utf8');
async function harness(config: Record<string,unknown> = {}, files = new Map<string,string>()) {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-01T01:00:00Z'));
  const schedules = new Map<string, () => Promise<void>>();
  const routes = new Map<string,any>();
  const delivered: any[] = [];
  const data = {probes: [] as any[], stats: [] as any[], failQuery:false, failSend:false, failStats:false};
  const c = {...config};
  const server = {
    getConfig: async () => c,
    cron: (expr: string, fn: () => Promise<void>) => schedules.set(expr,fn),
    route: (method:string,path:string,fn:any)=>routes.set(method+' '+path,fn),
    call: async (method: string, args?: any) => {
      if(method==='admin:getSettings')return {notification_enabled:true,notification_method:'telegram',notification_template:'{{emoji}} {{event}}\n{{client}}\n{{message}}\n{{time}}'};
      if (method === 'admin:getAllPingTasks') return [{id:1,name:'任务',target:'example.com',interval:1,clients:['node-a']}];
      if (method === 'common:getNodes') return {'node-a':{name:'节点'}};
      if (method === 'public:queryMetrics') {
        if (data.failQuery) throw Error('metrics temporarily unavailable');
        return {series:[{entity_id:'node-a',downsampled:false,points:data.probes}]};
      }
      if (method === 'public:getPingMetricStats') {
        if(data.failStats) throw Error('stats unavailable');
        return {stats:data.stats};
      }
      if (method === 'admin:sendNotification') {
        if (data.failSend) throw Error('channel down');
        delivered.push(args.event); return null;
      }
      throw Error(`Unexpected RPC: ${method}`);
    },
  };
  const disk = {existsSync:(p:string)=>files.has(p),mkdirSync:()=>{},
    readFileSync:(p:string)=>files.get(p),writeFileSync:(p:string,v:string)=>files.set(p,v),
    renameSync:(a:string,b:string)=>{files.set(b,files.get(a)!);files.delete(a);}};
  const context = vm.createContext({__storageDir__:'/storage',Date,console:{error:()=>{},warn:()=>{},log:()=>{}},
    require:(name:string)=>name==='server'?server:name==='fs'?disk:undefined});
  vm.runInContext(script(),context); await context.load();
  return {data,config:c,delivered,files,schedules,context,routes,
    poll:async () => {vi.setSystemTime(Date.now()+10000); await schedules.get('@every 10s')!();},
    probe:(n:number,value:number)=>({time:new Date(Date.parse('2026-11-01T01:00:00Z')+n*1000).toISOString(),value})};
}
afterEach(()=>vi.useRealTimers());
describe('bundled plugin integration', () => {
  it('counts new latency probes once and retains incidents through query errors', async () => {
    const h = await harness({failure_threshold:2});
    h.data.probes=[h.probe(1,-1)];await h.poll();
    h.data.failQuery=true;await h.poll();
    h.data.failQuery=false;h.data.probes.push(h.probe(3,-1));await h.poll();
    expect(h.delivered.map(e=>e.code)).toEqual(['PingFailure']);
    await h.poll();expect(h.delivered).toHaveLength(1);
    h.data.probes.push(h.probe(5,50),h.probe(6,40));await h.poll();
    expect(h.delivered.map(e=>e.code)).toEqual(['PingFailure','PingRecovery']);
  });
  it('keeps failed sends pending and retries in order', async () => {
    const h=await harness({failure_threshold:1,recovery_threshold:1});
    h.data.failSend=true;h.data.probes=[h.probe(1,-1)];await h.poll();
    h.data.failSend=false;h.data.probes.push(h.probe(2,10));await h.poll();
    expect(h.delivered).toHaveLength(0);
    vi.setSystemTime(Date.now()+120000);await h.poll();
    expect(h.delivered.map(e=>e.code)).toEqual(['PingFailure','PingRecovery']);
  });
  it('deduplicates the same calendar period and reports only enabled probe metrics', async () => {
    const h=await harness({enabled:true,daily_enabled:true});
    h.data.stats=[{entity_id:'node-a',task_id:'1',total:20,valid:18,avg:25,loss:10}];
    await h.schedules.get('0 9 * * *')!();await h.schedules.get('0 9 * * *')!();
    expect(h.delivered).toHaveLength(1);
    expect(h.delivered[0].message).toContain('25.00 ms');
    expect(h.delivered[0].message).not.toContain('丢包率');
    expect(h.delivered[0].code).toBe('PingDailyReport');
  });
  it('retries report collection after an API outage using the original requested range', async () => {
    const h=await harness({enabled:true,custom_enabled:true,custom_hours:0.5});
    h.data.failStats=true;await h.schedules.get('0 */6 * * *')!();
    expect(h.delivered).toHaveLength(0);
    h.data.failStats=false;vi.setSystemTime(Date.now()+120000);await h.poll();
    expect(h.delivered).toHaveLength(1);
    expect(h.delivered[0].message).toContain('2026-11-01 08:30:00');
    expect(h.delivered[0].message).toContain('总体平均延迟：无数据');
  });
  it('does not register report jobs unless explicitly enabled', async () => {
    const h=await harness();expect([...h.schedules.keys()]).toEqual(['@every 10s']);
  });
  it('suppresses all reports when both detections are off',async()=>{
    const h=await harness({enabled:false,loss_enabled:false,daily_enabled:true});
    await h.schedules.get('0 9 * * *')!();await h.poll();expect(h.delivered).toEqual([]);
    expect(JSON.parse(h.files.get('/storage/state-v2.json')!).requests).toEqual([]);
  });
  it('reports and detects loss independently when probe detection is off',async()=>{
    const h=await harness({enabled:false,loss_enabled:true,loss_window_probes:2,daily_enabled:true});
    h.data.probes=[h.probe(1,-1),h.probe(2,25)];await h.poll();
    expect(h.delivered.map(e=>e.code)).toEqual(['PingLossFailure']);
    expect(h.delivered[0].message).not.toContain('延迟');
    h.data.stats=[{entity_id:'node-a',task_id:'1',total:10,valid:9,avg:20,loss:10}];
    await h.schedules.get('0 9 * * *')!();
    expect(h.delivered[1].message).toContain('10.00%');expect(h.delivered[1].message).not.toContain('延迟');
  });
  it('drops a queued report if its enabled metric set changed',async()=>{
    const h=await harness({enabled:true,loss_enabled:true,daily_enabled:true});
    h.data.failSend=true;await h.schedules.get('0 9 * * *')!();
    h.config.loss_enabled=false;h.data.failSend=false;vi.setSystemTime(Date.now()+120000);await h.poll();
    expect(h.delivered).toEqual([]);
  });
  async function route(h:Awaited<ReturnType<typeof harness>>,action:string,input:any,admin=true,headers:any={}) {
    let data:any;const res:any={statusCode:200,setHeader:()=>{},end:(v:string)=>{data=JSON.parse(v);}};
    const req:any={context:{principal:{roles:admin?['admin']:[]}},headers:{'content-type':'application/json','x-ping-alert-test':'1','sec-fetch-site':'same-origin',origin:'https://komari.example',...headers},body:JSON.stringify(input)};
    await h.routes.get(`POST /api/plugins/ping-alert/test/${action}`)(req,res);return {status:res.statusCode,data};
  }
  it('previews using the saved template and never alters monitoring state or sends',async()=>{
    const h=await harness({failure_template:'<p>任务：{{task}}</p><p>延迟：{{latency}}</p>'});
    const before=h.files.get('/storage/state-v2.json');
    const result=await route(h,'preview',{type:'ping-failure',latency:250});
    expect(result.status).toBe(200);expect(result.data.preview).toContain('【模拟】探测异常');
    expect(result.data.preview).toContain('任务：任务\n延迟：250.00 ms');
    expect(result.data.preview).not.toContain('<p>');expect(h.delivered).toEqual([]);
    expect(h.files.get('/storage/state-v2.json')).toBe(before);
  });
  it('sends one marked simulation only after a send request, without saving temporary templates',async()=>{
    const h=await harness();const before=h.files.get('/storage/state-v2.json');
    const input={type:'ping-failure',templates:{failure_template:'临时模板 {{count}} 次'}};
    const sent=await route(h,'send',input);expect(sent.data.sent).toBe(true);
    expect(h.delivered).toHaveLength(1);expect(h.delivered[0].message).toContain('模拟');
    expect(h.delivered[0].message).toContain('临时模板 10 次');
    expect(h.files.get('/storage/state-v2.json')).toBe(before);
    expect((await route(h,'send',input)).status).toBe(429);
  });
  it('rejects unauthenticated and cross-site simulation requests',async()=>{
    const h=await harness();
    expect((await route(h,'send',{type:'ping-failure'},false)).status).toBe(403);
    expect((await route(h,'send',{type:'ping-failure'},true,{origin:'https://evil.example','sec-fetch-site':'cross-site'})).status).toBe(403);
    expect((await route(h,'send',{type:'ping-failure'},true,{'x-ping-alert-test':''})).status).toBe(403);
    expect(h.delivered).toEqual([]);
  });
  it('simulates only enabled report metrics and refuses an empty report',async()=>{
    const h=await harness({enabled:false,loss_enabled:true});
    const preview=await route(h,'preview',{type:'report'});
    expect(preview.status).toBe(200);expect(preview.data.preview).toContain('平均丢包率');
    expect(preview.data.preview).not.toContain('平均延迟');
    h.config.loss_enabled=false;
    expect((await route(h,'preview',{type:'report'})).status).toBe(400);
  });
});
