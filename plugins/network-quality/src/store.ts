import { defaultConfig, validateConfig } from './config';
import type { PersistentState, Report } from './types';
type FileSystem = { existsSync(path:string):boolean; mkdirSync(path:string,options:unknown):void; readFileSync(path:string,encoding:string):string; writeFileSync(path:string,value:string,encoding:string):void; renameSync(from:string,to:string):void; unlinkSync(path:string):void };
export class StateStore {
  private readonly stateFile: string;
  constructor(private readonly directory: string, private readonly fs: FileSystem = require('fs')) { this.stateFile = `${directory}/state-v1.json`; }
  load(now: number): PersistentState {
    if (!this.fs.existsSync(this.stateFile)) return { version: 1, config: defaultConfig(), jobs: [], reports: [], lastScheduleMinute: Math.floor(now / 60000) };
    const parsed = JSON.parse(this.fs.readFileSync(this.stateFile,'utf8')) as PersistentState;
    if (parsed.version !== 1 || !Array.isArray(parsed.jobs) || !Array.isArray(parsed.reports)) throw new Error('检测插件状态文件损坏，请从备份恢复，避免重复执行');
    parsed.config = validateConfig(parsed.config); return parsed;
  }
  save(state: PersistentState): void { this.write(this.stateFile, JSON.stringify(state)); }
  private write(path:string, value:string) { this.fs.mkdirSync(this.directory,{recursive:true}); this.fs.writeFileSync(`${path}.tmp`,value,'utf8'); this.fs.renameSync(`${path}.tmp`,path); }
  rawPath(id: string): string { if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new Error('报告标识不正确'); return `${this.directory}/raw-${id}.txt`; }
  saveRaw(id: string, raw: string) { this.write(this.rawPath(id),raw); }
  readRaw(id: string): string { const path = this.rawPath(id); return this.fs.existsSync(path) ? this.fs.readFileSync(path,'utf8') : '原始输出已过期或不存在'; }
  removeRaw(id:string) { const path = this.rawPath(id); if(this.fs.existsSync(path))this.fs.unlinkSync(path); }
  prune(state: PersistentState, now: number): void {
    const keep: Report[] = [], counts: Record<string,number> = {}, cutoff = now - state.config.retentionDays * 86400000;
    for (const report of [...state.reports].sort((a,b) => Date.parse(b.completedAt)-Date.parse(a.completedAt))) {
      counts[report.uuid] ??= 0;
      if (Date.parse(report.completedAt) >= cutoff && counts[report.uuid] < state.config.maxReportsPerNode) { keep.push(report); counts[report.uuid]++; }
      else this.removeRaw(report.id);
    }
    state.reports = keep;
    const reportIds = new Set(keep.map(report => report.id));
    const pending = state.jobs.filter(job => !job.completedAt);
    const finished = state.jobs.filter(job => job.completedAt && Date.parse(job.completedAt) >= cutoff && (reportIds.has(job.id) || job.mode !== 'detect')).slice(-2000);
    state.jobs = [...pending,...finished];
  }
}
