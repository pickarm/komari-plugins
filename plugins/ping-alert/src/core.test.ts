import { describe, expect, it } from "vitest";
import { monitorKey, processSamples, type MonitorEntry } from "./core";

const sample = (second: number, value: number) => ({
  time: `2026-11-01T00:00:${String(second).padStart(2, "0")}.000Z`,
  value,
});

describe("processSamples", () => {
  it("waits for the tenth failed probe with the requested default", () => {
    const nine = processSamples(undefined, Array.from({ length: 9 }, (_, i) => sample(i + 1, 1)), 10, 2);
    expect(nine.transitions).toEqual([]);
    expect(processSamples(nine.entry, [sample(10, 1)], 10, 2).transitions).toHaveLength(1);
  });

  it("does not count duplicate timestamps or invalid/aggregate values", () => {
    const result = processSamples(undefined, [sample(1, 1), sample(1, 1), sample(2, 0.75), sample(3, NaN)], 2, 2);
    expect(result.entry.failureStreak).toBe(1);
    expect(result.transitions).toEqual([]);
  });

  it("breaks a streak after a long gap while retaining active incidents", () => {
    const first = processSamples(undefined, [sample(1, 1)], 2, 2);
    const next = processSamples(first.entry, [sample(30, 1)], 2, 2, 10);
    expect(next.entry.failureStreak).toBe(1);
    expect(next.transitions).toEqual([]);
    expect(processSamples({ ...first.entry, alertActive: true }, [sample(30, 0)], 2, 2, 10).entry.alertActive).toBe(true);
  });

  it("alerts only after the configured consecutive failure threshold", () => {
    const first = processSamples(undefined, [sample(1, 1), sample(2, 1)], 3, 2);
    expect(first.transitions).toEqual([]);
    const second = processSamples(first.entry, [sample(3, 1)], 3, 2);
    expect(second.transitions).toEqual([
      { type: "failure", streak: 3, time: sample(3, 1).time },
    ]);
  });

  it("resets the failure streak after a successful probe", () => {
    const result = processSamples(
      undefined,
      [sample(1, 1), sample(2, 0), sample(3, 1), sample(4, 1)],
      3,
      2,
    );
    expect(result.transitions).toEqual([]);
    expect(result.entry.failureStreak).toBe(2);
  });

  it("deduplicates an active failure and emits one recovery", () => {
    const failed = processSamples(
      undefined,
      [sample(1, 1), sample(2, 1), sample(3, 1)],
      3,
      2,
    );
    const stillFailed = processSamples(
      failed.entry,
      [sample(3, 1), sample(4, 1), sample(5, 1)],
      3,
      2,
    );
    expect(stillFailed.transitions).toEqual([]);
    const recovered = processSamples(
      stillFailed.entry,
      [sample(6, 0), sample(7, 0), sample(8, 0)],
      3,
      2,
    );
    expect(recovered.transitions).toEqual([
      { type: "recovery", streak: 2, time: sample(7, 0).time },
    ]);
  });

  it("ignores samples already processed before a restart", () => {
    const state: MonitorEntry = {
      lastProcessedAt: sample(3, 1).time,
      failureStreak: 3,
      successStreak: 0,
      alertActive: true,
    };
    const result = processSamples(
      state,
      [sample(1, 1), sample(2, 1), sample(3, 1)],
      3,
      2,
    );
    expect(result.transitions).toEqual([]);
    expect(result.entry).toEqual(state);
  });

  it("keeps task and node state independent", () => {
    expect(monitorKey(1, "node-a")).not.toBe(monitorKey(1, "node-b"));
    expect(monitorKey(1, "node-a")).not.toBe(monitorKey(2, "node-a"));
  });
});
