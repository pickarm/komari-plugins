import { validateCron } from './schedules';
import type { DetectionOptions, PluginConfig, Schedule } from './types';

export const PROVINCES = [
  ['bj','北京'],['tj','天津'],['he','河北'],['sx','山西'],['nm','内蒙古'],['ln','辽宁'],['jl','吉林'],['hl','黑龙江'],['sh','上海'],['js','江苏'],['zj','浙江'],['ah','安徽'],['fj','福建'],['jx','江西'],['sd','山东'],['ha','河南'],['hb','湖北'],['hn','湖南'],['gd','广东'],['gx','广西'],['hi','海南'],['cq','重庆'],['sc','四川'],['gz','贵州'],['yn','云南'],['xz','西藏'],['sn','陕西'],['gs','甘肃'],['qh','青海'],['nx','宁夏'],['xj','新疆'],
].map(([code,name]) => ({ code, name }));
export function defaultOptions(): DetectionOptions { return { modules: ['routes','unlocks'], ipv: '4', provinces: PROVINCES.map(p => p.code), count: 30, parallel: 4, timeoutMinutes: 30 }; }
export function defaultConfig(): PluginConfig { return { enabled: true, publicEnabled: true, defaults: defaultOptions(), retentionDays: 90, maxReportsPerNode: 100, schedules: {} }; }
export function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}格式不正确`);
  return value as Record<string, unknown>;
}
function keys(value: Record<string,unknown>, allowed: string[]) { if (Object.keys(value).some(key => !allowed.includes(key))) throw new Error('配置含有不支持的字段'); }
function bool(value: unknown, label: string): boolean { if (typeof value !== 'boolean') throw new Error(`${label}必须是开关`); return value; }
function integer(value: unknown, minimum: number, maximum: number, label: string): number { if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum || value > maximum) throw new Error(`${label}范围为 ${minimum}–${maximum}`); return value; }
export function validateOptions(input: unknown, base: DetectionOptions = defaultOptions()): DetectionOptions {
  const source = object(input, '检测参数'); keys(source, ['modules','ipv','provinces','count','parallel','timeoutMinutes']);
  const merged = { ...base, ...source };
  if (!Array.isArray(merged.modules) || !merged.modules.length || merged.modules.some(value => value !== 'routes' && value !== 'unlocks')) throw new Error('至少选择一种有效的检测模块');
  if (typeof merged.ipv !== 'string' || !['4','6','both'].includes(merged.ipv)) throw new Error('请选择 IPv4、IPv6 或双栈');
  if (!Array.isArray(merged.provinces) || !merged.provinces.length || merged.provinces.some(value => typeof value !== 'string' || !PROVINCES.some(p => p.code === value))) throw new Error('请选择有效的检测省份');
  return { modules: [...new Set(merged.modules)], ipv: merged.ipv as DetectionOptions['ipv'], provinces: [...new Set(merged.provinces)], count: integer(merged.count,1,600,'探测次数'), parallel: integer(merged.parallel,1,31,'探测并发'), timeoutMinutes: integer(merged.timeoutMinutes,1,30,'任务超时分钟') };
}
export function validateConfig(input: unknown): PluginConfig {
  const source = object(input,'插件配置'); keys(source, ['enabled','publicEnabled','defaults','retentionDays','maxReportsPerNode','schedules']);
  const defaults = validateOptions(source.defaults), scheduleSource = object(source.schedules,'定时配置'), schedules: Record<string,Schedule> = {};
  if (Object.keys(scheduleSource).length > 500) throw new Error('定时节点过多');
  for (const [uuid, value] of Object.entries(scheduleSource)) {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(uuid) || ['__proto__','prototype','constructor'].includes(uuid)) throw new Error('节点标识不正确');
    const entry = object(value,'节点定时'); keys(entry,['enabled','kind','time','weekday','cron','options']);
    if (!['daily','weekly','custom'].includes(String(entry.kind))) throw new Error('请选择每日、每周或自定义定时');
    if (typeof entry.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(entry.time)) throw new Error('时间应为 HH:mm');
    if (typeof entry.cron !== 'string') throw new Error('Cron 格式不正确');
    schedules[uuid] = { enabled: bool(entry.enabled,'节点定时'), kind: entry.kind as Schedule['kind'], time: entry.time, weekday: integer(entry.weekday,0,6,'星期'), cron: validateCron(entry.cron), ...(entry.options === undefined ? {} : { options: validateOptions(entry.options,defaults) }) };
  }
  return { enabled: bool(source.enabled,'启用检测'), publicEnabled: bool(source.publicEnabled,'公开展示'), defaults, retentionDays: integer(source.retentionDays,1,3650,'保留天数'), maxReportsPerNode: integer(source.maxReportsPerNode,1,1000,'每节点报告数量'), schedules };
}
