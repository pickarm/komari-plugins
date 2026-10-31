import { describe, expect, it } from 'vitest';
import { rules } from './config';
import { freshMonitor, processProbes } from './monitor';
const start = '2026-11-01T00:00:00Z';
const probe = (n: number, value: number | null) => ({time: new Date(Date.parse(start) + n * 1000).toISOString(), value});
describe('probe-based rules', () => {
  it('defaults to ten actual failed probes and deduplicates re-reads', () => {
    const r = rules({}), initial = freshMonitor(start);
    const nine = processProbes(initial, Array.from({length:9}, (_, i) => probe(i + 1, -1)), r, 90);
    expect(nine.changes).toEqual([]);
    const tenth = processProbes(nine.state, [probe(9,-1),probe(10,-1),probe(10,-1)], r, 90);
    expect(tenth.changes).toHaveLength(1);
    expect(tenth.changes[0].count).toBe(10);
    expect(processProbes(tenth.state,[probe(11,-1)],r,90).changes).toEqual([]);
  });
  it('requires a low-latency recovery and resets consecutive counts in hysteresis band', () => {
    const r = rules({failure_delay_ms:200,recovery_delay_ms:150,failure_threshold:2});
    const bad = processProbes(freshMonitor(start),[probe(1,201),probe(2,250)],r,90);
    expect(bad.changes[0].recovered).toBe(false);
    const neutral = processProbes(bad.state,[probe(3,150),probe(4,175),probe(5,150)],r,90);
    expect(neutral.changes).toEqual([]);
    expect(processProbes(neutral.state,[probe(6,100)],r,90).changes[0].recovered).toBe(true);
  });
  it('uses strictly greater-than failure threshold and inclusive recovery threshold', () => {
    const r = rules({failure_delay_ms:200,failure_threshold:1});
    expect(processProbes(freshMonitor(start),[probe(1,200)],r,90).changes).toEqual([]);
    expect(processProbes(freshMonitor(start),[probe(1,200.01)],r,90).changes).toHaveLength(1);
  });
  it('defaults to exactly -1 as failure and otherwise unrestricted recovery', () => {
    const r = rules({failure_threshold:1});
    expect(r.failureMs).toBe(-1);expect(r.recoveryMs).toBeNull();
    const high = processProbes(freshMonitor(start),[probe(1,9999)],r,90);
    expect(high.changes).toEqual([]);
    expect(processProbes(high.state,[probe(2,-1)],r,90).changes[0].recovered).toBe(false);
    const failed=processProbes(high.state,[probe(2,-1)],r,90);
    const recovered=processProbes(failed.state,[probe(3,99999),probe(4,99999)],r,90);
    expect(recovered.changes[0].recovered).toBe(true);
  });
  it('requires a full rolling window and supports independent loss alerts and recovery', () => {
    const r = rules({loss_enabled:true,loss_window_probes:4,loss_failure_percent:50,loss_recovery_percent:0,loss_recovery_probes:1});
    const first = processProbes(freshMonitor(start),[probe(1,-1),probe(2,-1),probe(3,30)],r,90);
    expect(first.changes).toEqual([]);
    const bad = processProbes(first.state,[probe(4,30)],r,90);
    expect(bad.changes).toMatchObject([{rule:'loss',lossPercent:50,recovered:false}]);
    expect(bad.state.ping.active).toBe(false);
    const good = processProbes(bad.state,[probe(5,30),probe(6,30)],r,90);
    expect(good.changes).toMatchObject([{rule:'loss',lossPercent:0,recovered:true}]);
  });
  it('does not count high latency as packet loss', () => {
    const r = rules({loss_enabled:true,loss_window_probes:2,loss_failure_percent:1});
    expect(processProbes(freshMonitor(start),[probe(1,1000),probe(2,2000)],r,90).changes).toEqual([]);
  });
  it('can disable loss detection entirely', () => {
    expect(processProbes(freshMonitor(start),[probe(1,-1),probe(2,-1)],rules({loss_window_probes:2}),90).changes).toEqual([]);
  });
  it('requires configured consecutive loss breaches', () => {
    const r = rules({loss_enabled:true,loss_window_probes:2,loss_failure_probes:2,loss_failure_percent:50});
    const s = processProbes(freshMonitor(start),[probe(1,-1),probe(2,30)],r,90);
    expect(s.changes).toEqual([]);
    expect(processProbes(s.state,[probe(3,-1)],r,90).changes).toHaveLength(1);
  });
  it('resets counts and the loss window after a data gap without fabricating recovery', () => {
    const r = rules({failure_threshold:2});
    const a = processProbes(freshMonitor(start),[probe(1,-1)],r,90);
    expect(processProbes(a.state,[probe(100,-1)],r,90).changes).toEqual([]);
    a.state.ping.active = true;
    expect(processProbes(a.state,[probe(100,20)],r,90).state.ping.active).toBe(true);
  });
  it('does not replay earlier probes after load and preserves incident status', () => {
    const old = freshMonitor(start); old.ping.active = true; old.ping.bad = 10;
    const s = freshMonitor(probe(20,0).time,old);
    expect(s.ping.active).toBe(true); expect(s.ping.bad).toBe(0);
    expect(processProbes(s,[probe(10,-1)],rules({}),90).changes).toEqual([]);
  });
  it('ignores invalid and null samples and never mutates input', () => {
    const s = freshMonitor(start);
    const result = processProbes(s,[probe(1,null),probe(2,NaN),{time:'bad',value:-1}],rules({failure_threshold:1}),90);
    expect(result.changes).toEqual([]); expect(s).toEqual(freshMonitor(start));
  });
  it('keeps explicit definitions independent and ignores the superseded toggle and defaults', () => {
    expect(rules({failure_threshold:NaN,failure_delay_ms:200,recovery_delay_ms:900,loss_failure_percent:20,loss_recovery_percent:90}))
      .toMatchObject({failureCount:10,recoveryMs:900,lossLow:20});
    expect(rules({latency_enabled:true,failure_latency_ms:300,recovery_latency_ms:300})).toMatchObject({failureMs:-1,recoveryMs:null});
  });
  it('uses a custom recovery limit with default -1 failure definition',()=>{
    const r=rules({failure_threshold:1,recovery_threshold:1,recovery_delay_ms:'300'});
    const failed=processProbes(freshMonitor(start),[probe(1,-1)],r,90);
    expect(processProbes(failed.state,[probe(2,301)],r,90).changes).toEqual([]);
    expect(processProbes(failed.state,[probe(2,300)],r,90).changes[0].recovered).toBe(true);
  });
  it('does not require a recovery limit when failure delay is customized',()=>{
    const r=rules({failure_threshold:1,recovery_threshold:1,failure_delay_ms:300});
    const failed=processProbes(freshMonitor(start),[probe(1,301)],r,90);
    expect(processProbes(failed.state,[probe(2,300)],r,90).changes[0].recovered).toBe(true);
    expect(processProbes(failed.state,[probe(2,-1)],r,90).changes).toEqual([]);
  });
  it('treats any finite result other than -1 as healthy under defaults, never missing data',()=>{
    const r=rules({failure_threshold:1,recovery_threshold:1});
    const failed=processProbes(freshMonitor(start),[probe(1,-1)],r,90);
    expect(processProbes(failed.state,[probe(2,null)],r,90).changes).toEqual([]);
    expect(processProbes(failed.state,[probe(2,-2)],r,90).changes[0].recovered).toBe(true);
    expect(rules({recovery_delay_ms:''}).recoveryMs).toBeNull();
    expect(rules({recovery_delay_ms:'不限'}).recoveryMs).toBeNull();
  });
});
