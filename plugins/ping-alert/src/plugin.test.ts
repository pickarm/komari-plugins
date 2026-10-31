import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
const script = () => fs.readFileSync('script.js', 'utf8');
async function harness(config: Record<string,unknown> = {}, files = new Map<string,string>()) {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-01T01:00:00Z'));
  const schedules = new Map<string, () => Promise<void>>();
  const delivered: any[] = [];
  const data = {probes: [] as any[], stats: [] as any[], failQuery:false, failSend:false, failStats:false};
  const c = {...config};
  const server = {
    getConfig: async () => c,
    cron: (expr: string, fn: () => Promise<void>) => schedules.set(expr,fn),
    call: async (method: string, args?: any) => {
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
  return {data,config:c,delivered,files,schedules,context,
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
    expect(h.delivered.map(e=>e.event)).toEqual(['PingFailure']);
    await h.poll();expect(h.delivered).toHaveLength(1);
    h.data.probes.push(h.probe(5,50),h.probe(6,40));await h.poll();
    expect(h.delivered.map(e=>e.event)).toEqual(['PingFailure','PingRecovery']);
  });
  it('keeps failed sends pending and retries in order', async () => {
    const h=await harness({failure_threshold:1,recovery_threshold:1});
    h.data.failSend=true;h.data.probes=[h.probe(1,-1)];await h.poll();
    h.data.failSend=false;h.data.probes.push(h.probe(2,10));await h.poll();
    expect(h.delivered).toHaveLength(0);
    vi.setSystemTime(Date.now()+120000);await h.poll();
    expect(h.delivered.map(e=>e.event)).toEqual(['PingFailure','PingRecovery']);
  });
  it('runs reports independently and deduplicates the same calendar period', async () => {
    const h=await harness({enabled:false,daily_enabled:true});
    h.data.stats=[{entity_id:'node-a',task_id:'1',total:20,valid:18,avg:25,loss:10}];
    await h.schedules.get('0 9 * * *')!();await h.schedules.get('0 9 * * *')!();
    expect(h.delivered).toHaveLength(1);
    expect(h.delivered[0].message).toContain('25.00 ms');
    expect(h.delivered[0].message).toContain('10.00%');
    expect(h.delivered[0].event).toBe('PingDailyReport');
  });
  it('retries report collection after an API outage using the original requested range', async () => {
    const h=await harness({enabled:false,custom_enabled:true,custom_hours:0.5});
    h.data.failStats=true;await h.schedules.get('0 */6 * * *')!();
    expect(h.delivered).toHaveLength(0);
    h.data.failStats=false;vi.setSystemTime(Date.now()+120000);await h.poll();
    expect(h.delivered).toHaveLength(1);
    expect(h.delivered[0].message).toContain('2026-11-01T00:30:00.000Z');
    expect(h.delivered[0].message).toContain('总体平均延迟：无数据');
  });
  it('does not register report jobs unless explicitly enabled', async () => {
    const h=await harness();expect([...h.schedules.keys()]).toEqual(['@every 10s']);
  });
});
