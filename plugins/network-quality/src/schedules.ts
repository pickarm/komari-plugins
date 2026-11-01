import type { Schedule } from './types';

const bounds: [number, number][] = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 7]];
function fieldValues(expression: string, index: number): Set<number> {
  const [minimum, maximum] = bounds[index], result = new Set<number>();
  for (const part of expression.split(',')) {
    const match = /^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/.exec(part);
    if (!match) throw new Error('Cron 仅支持数字、星号、范围、列表和步长');
    const step = match[2] ? Number(match[2]) : 1;
    if (step < 1 || step > maximum + 1) throw new Error('Cron 步长超出范围');
    let low: number, high: number;
    if (match[1] === '*') { low = minimum; high = maximum; }
    else if (match[1].includes('-')) [low, high] = match[1].split('-').map(Number);
    else { low = Number(match[1]); high = match[2] ? maximum : low; }
    if (low < minimum || high > maximum || low > high) throw new Error('Cron 数字超出范围');
    for (let value = low; value <= high; value += step) result.add(index === 4 && value === 7 ? 0 : value);
  }
  return result;
}
export function validateCron(expression: string): string {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5 || expression.length > 150) throw new Error('Cron 必须是五段表达式（分 时 日 月 周）');
  fields.forEach(fieldValues); return fields.join(' ');
}
export function scheduleCron(schedule: Schedule): string {
  if (schedule.kind === 'custom') return validateCron(schedule.cron);
  const [hour, minute] = schedule.time.split(':').map(Number);
  return `${minute} ${hour} * * ${schedule.kind === 'weekly' ? schedule.weekday : '*'}`;
}
export function cronMatches(expression: string, time: number): boolean {
  const fields = validateCron(expression).split(' '), values = fields.map(fieldValues);
  // Use a fixed offset instead of the Komari host's local timezone.
  const local = new Date(time + 8 * 3600000);
  const parts = [local.getUTCMinutes(), local.getUTCHours(), local.getUTCDate(), local.getUTCMonth() + 1, local.getUTCDay()];
  if (![0, 1, 3].every(index => values[index].has(parts[index]))) return false;
  const day = values[2].has(parts[2]), weekday = values[4].has(parts[4]);
  return fields[2] !== '*' && fields[4] !== '*' ? day || weekday : day && weekday;
}
