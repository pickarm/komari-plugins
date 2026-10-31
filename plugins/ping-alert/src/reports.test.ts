import { describe, expect, it } from 'vitest';
import { reportRange, summarize, latencyText } from './reports';
describe('reports', () => {
  it('weights latency by successful samples and loss by all actual probes', () => {
    const s = summarize([
      {entity_id:'a',task_id:'1',total:10,valid:8,avg:100,loss:20},
      {entity_id:'b',task_id:'1',total:100,valid:100,avg:10,loss:0},
    ]);
    expect(s.averageLatency).toBeCloseTo(1800 / 108);
    expect(s.averageLoss).toBeCloseTo(2 / 110 * 100);
  });
  it('shows missing data and all-loss periods correctly', () => {
    expect(summarize([])).toMatchObject({averageLatency:null,averageLoss:null});
    expect(summarize([{entity_id:'a',task_id:'1',total:10,valid:0,avg:null,loss:100}]))
      .toMatchObject({averageLatency:null,averageLoss:100});
    expect(latencyText(null)).toBe('无成功采样');
  });
  it('selects complete previous calendar periods including leap months and year boundaries', () => {
    const now = new Date(2024,2,1,9);
    const month = reportRange('monthly',now);
    expect(month.start.getMonth()).toBe(1); expect(month.start.getDate()).toBe(1);
    expect(month.end.getMonth()).toBe(2);
    const year = reportRange('monthly',new Date(2026,0,1,9));
    expect(year.start.getFullYear()).toBe(2025); expect(year.start.getMonth()).toBe(11);
    const day = reportRange('daily',now);
    expect(day.start.getDate()).toBe(29); expect(day.end.getDate()).toBe(1);
  });
  it('selects last Monday-to-Monday week', () => {
    const range = reportRange('weekly',new Date(2026,10,4,9));
    expect(range.end.getDay()).toBe(1); expect(range.start.getDay()).toBe(1);
    expect(range.start.getDate()).toBe(26); expect(range.end.getDate()).toBe(2);
  });
  it('supports fractional-hour rolling custom spans', () => {
    const now = new Date(); const range = reportRange('custom',now,0.5);
    expect(range.end.getTime() - range.start.getTime()).toBe(1800000);
  });
  it('retains aggregate approximation markers', () => {
    expect(summarize([{entity_id:'a',task_id:'1',total:2,valid:1,avg:10,loss:50,loss_approximate:true}]).approximate).toBe(true);
  });
});
