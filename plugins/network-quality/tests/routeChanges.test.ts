import { describe, expect, it } from 'vitest';
import { compareRoutes } from '../src/routeChanges';
import { defaultConfig } from '../src/config';
import type { Report, RouteResult } from '../src/types';
const route: RouteResult = { province:'上海市',carrier:'电信',family:4,packetType:'large',line:'CN2 GIA',latency:128,loss:0,sent:30,received:30,status:'ok' };
const baseline: Report = {id:'before',uuid:'a',startedAt:'2026-11-01T00:00:00Z',completedAt:'2026-11-01T00:05:00Z',status:'succeeded',ipv:'both',routes:[route],unlocks:[],errors:[],options:defaultConfig().defaults,engines:{TcpQuality:'pinned'}};
const current = (routes: RouteResult[] = [{...route,province:'上海',line:'163'}]): Report => ({...baseline,id:'now',startedAt:'2026-11-02T00:00:00Z',completedAt:'2026-11-02T00:05:00Z',routes});
describe('route change archive',()=>{
  it('records before/after and source time per normalized province/carrier/family/packet',()=>{
    expect(compareRoutes(current(),[baseline])).toEqual({compared:1,changes:[{province:'上海',carrier:'电信',family:4,packetType:'large',before:'CN2 GIA',after:'163',previousReportId:'before',previousCompletedAt:baseline.completedAt}]});
  });
  it('ignores spacing/case and transient target address differences',()=>{
    expect(compareRoutes(current([{...route,line:'cn2  GIA'}]),[baseline]).changes).toEqual([]);
    expect(compareRoutes(current([{...route,line:'CN2 GIA 2.3.4.5'}]),[{...baseline,routes:[{...route,line:'CN2 GIA 1.2.3.4'}]}]).changes).toEqual([]);
  });
  it('does not mix nodes, families, carriers, packet types or engine versions',()=>{
    for(const previous of [{...baseline,uuid:'b'},{...baseline,routes:[{...route,family:6 as const}]},{...baseline,routes:[{...route,carrier:'联通' as const}]},{...baseline,routes:[{...route,packetType:'standard' as const}]},{...baseline,engines:{TcpQuality:'other'}}]) expect(compareRoutes(current(),[previous]).compared).toBe(0);
  });
  it('skips no-response/failure/unknown samples instead of reporting route switches',()=>{
    for(const status of ['no-response','failed','unsupported'] as const) expect(compareRoutes(current([{...route,status,line:null}]),[baseline]).changes).toEqual([]);
    expect(compareRoutes(current([{...route,line:'unknown'}]),[baseline]).compared).toBe(0);
    expect(compareRoutes({...current(),status:'failed'},[baseline]).compared).toBe(0);
  });
  it('finds last valid sample per target across partial reports and counts duplicates once',()=>{
    const broken={...baseline,id:'broken',completedAt:'2026-11-01T12:00:00Z',status:'partial' as const,routes:[{...route,status:'no-response' as const,line:null}]};
    expect(compareRoutes(current(),[broken,baseline]).changes[0].previousReportId).toBe('before');
    const newer={...baseline,id:'newer',completedAt:'2026-11-01T10:00:00Z',routes:[{...route,line:'163'}]};
    expect(compareRoutes(current(),[baseline,newer]).changes).toEqual([]);
    expect(compareRoutes(current([{...route,line:'163'},{...route,line:'163'}]),[baseline]).compared).toBe(1);
  });
  it('does not compare against future/self history and leaves first-run state explicit',()=>{
    expect(compareRoutes(current(),[])).toEqual({compared:0,changes:[]});
    expect(compareRoutes(current(),[{...baseline,completedAt:'2026-11-03T00:00:00Z'},current()]).compared).toBe(0);
  });
});
