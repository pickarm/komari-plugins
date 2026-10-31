export type Sample = {
  time: string;
  value: number | null;
};

export type MonitorEntry = {
  lastProcessedAt: string;
  failureStreak: number;
  successStreak: number;
  alertActive: boolean;
};

export type Transition =
  | { type: "failure"; streak: number; time: string }
  | { type: "recovery"; streak: number; time: string };

export type ProcessResult = {
  entry: MonitorEntry;
  transitions: Transition[];
};

export const EMPTY_ENTRY: MonitorEntry = {
  lastProcessedAt: "",
  failureStreak: 0,
  successStreak: 0,
  alertActive: false,
};

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function processSamples(
  previous: MonitorEntry | undefined,
  samples: Sample[],
  failureThreshold: number,
  recoveryThreshold: number,
  maxGapSeconds = 0,
): ProcessResult {
  const entry: MonitorEntry = { ...(previous ?? EMPTY_ENTRY) };
  const transitions: Transition[] = [];
  const lastProcessed = timestamp(entry.lastProcessedAt);
  const ordered = [...samples]
    .filter((sample) => timestamp(sample.time) > lastProcessed)
    .sort((left, right) => timestamp(left.time) - timestamp(right.time));

  for (const sample of ordered) {
    if (timestamp(sample.time) <= timestamp(entry.lastProcessedAt)) continue;
    if (sample.value !== 0 && sample.value !== 1) continue;
    if (maxGapSeconds > 0 && timestamp(sample.time) - timestamp(entry.lastProcessedAt) > maxGapSeconds * 1000) {
      entry.failureStreak = 0;
      entry.successStreak = 0;
    }
    const failed = sample.value === 1;
    entry.lastProcessedAt = sample.time;

    if (failed) {
      entry.successStreak = 0;
      entry.failureStreak += 1;
      if (!entry.alertActive && entry.failureStreak >= failureThreshold) {
        entry.alertActive = true;
        transitions.push({
          type: "failure",
          streak: entry.failureStreak,
          time: sample.time,
        });
      }
      continue;
    }

    entry.failureStreak = 0;
    if (!entry.alertActive) {
      entry.successStreak = 0;
      continue;
    }

    entry.successStreak += 1;
    if (entry.successStreak >= recoveryThreshold) {
      entry.alertActive = false;
      transitions.push({
        type: "recovery",
        streak: entry.successStreak,
        time: sample.time,
      });
      entry.successStreak = 0;
    }
  }

  return { entry, transitions };
}

export function monitorKey(taskId: string | number, nodeId: string): string {
  return `${String(taskId)}:${nodeId}`;
}
