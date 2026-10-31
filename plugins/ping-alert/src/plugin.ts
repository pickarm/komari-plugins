import { definePlugin, server } from "@komari-monitor/plugin-sdk";
import {
  monitorKey,
  processSamples,
  type MonitorEntry,
  type Sample,
  type Transition,
} from "./core";

declare const __storageDir__: string;
declare function require(name: string): {
  existsSync(path: string): boolean;
  mkdirSync(path: string, options?: { recursive?: boolean }): void;
  readFileSync(path: string, encoding: string): string;
  renameSync(oldPath: string, newPath: string): void;
  writeFileSync(path: string, data: string, encoding: string): void;
};

const fs = require("fs");
const STATE_FILE = `${__storageDir__}/state.json`;
const STATE_TMP_FILE = `${__storageDir__}/state.json.tmp`;
const STATE_VERSION = 1;

type Config = {
  enabled?: unknown;
  all_tasks?: unknown;
  ping_tasks?: unknown;
  failure_threshold?: unknown;
  recovery_threshold?: unknown;
  notify_recovery?: unknown;
  lookback_minutes?: unknown;
  poll_seconds?: unknown;
  all_nodes?: unknown;
  nodes?: unknown;
  max_gap_seconds?: unknown;
  startup_history?: unknown;
  failure_template?: unknown;
  recovery_template?: unknown;
};

type PingTask = {
  id?: number;
  name?: string;
  target?: string;
  type?: string;
  interval?: number;
  clients?: string[];
};

type NodeInfo = { uuid?: string; name?: string };
type MetricSeries = {
  entity_id?: string;
  downsampled?: boolean;
  points?: Sample[];
};
type MetricResponse = { series?: MetricSeries[] };
type StoredState = {
  version: number;
  entries: Record<string, MonitorEntry>;
  pending?: { transition: Transition; task: PingTask; nodeId: string; attempts: number; nextAttempt: number }[];
};

let state: StoredState = { version: STATE_VERSION, entries: {} };
let polling = false;

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (value === undefined || value === null || value === "" || !Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.trunc(parsed)));
}

function selectedTaskIds(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set();
  return new Set(
    value
      .filter((item) => typeof item === "number" || typeof item === "string")
      .map(String),
  );
}

function loadState(): StoredState {
  try {
    fs.mkdirSync(__storageDir__, { recursive: true });
    if (!fs.existsSync(STATE_FILE)) {
      return { version: STATE_VERSION, entries: {} };
    }
    const parsed = JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as StoredState;
    if (parsed.version !== STATE_VERSION || !parsed.entries) {
      return { version: STATE_VERSION, entries: {} };
    }
    return parsed;
  } catch (error) {
    console.warn("ping-alert: failed to load state: %s", String(error));
    return { version: STATE_VERSION, entries: {} };
  }
}

function saveState(): void {
  fs.mkdirSync(__storageDir__, { recursive: true });
  fs.writeFileSync(STATE_TMP_FILE, JSON.stringify(state, null, 2), "utf8");
  fs.renameSync(STATE_TMP_FILE, STATE_FILE);
}

async function nodeMap(): Promise<Map<string, NodeInfo>> {
  const nodes = await server.call<Record<string, NodeInfo>>("common:getNodes");
  return new Map(Object.entries(nodes ?? {}));
}

async function queryTaskSamples(
  taskId: string,
  nodeIds: string[],
  lookbackMinutes: number,
): Promise<Map<string, Sample[]>> {
  const response = await server.call<MetricResponse>("public:queryMetrics", {
    metric_keys: ["ping.loss"],
    entity_ids: nodeIds,
    start: new Date(Date.now() - lookbackMinutes * 60_000).toISOString(),
    end: new Date().toISOString(),
    tags: { task_id: taskId },
    fill_empty: false,
    max_points: 1000,
  });
  const result = new Map<string, Sample[]>();
  for (const series of response.series ?? []) {
    if (!series.entity_id) continue;
    if (series.downsampled !== false) throw new Error("Raw Ping samples required; aggregated series cannot establish consecutive failures");
    result.set(series.entity_id, series.points ?? []);
  }
  return result;
}

function taskLabel(task: PingTask): string {
  return task.name?.trim() || `Ping #${String(task.id)}`;
}

function nodeLabel(nodeId: string, nodes: Map<string, NodeInfo>): string {
  return nodes.get(nodeId)?.name?.trim() || nodeId;
}

async function notify(
  transition: Transition,
  task: PingTask,
  nodeId: string,
  nodes: Map<string, NodeInfo>,
  config: Config,
): Promise<void> {
  const failed = transition.type === "failure";
  const event = failed ? "PingFailure" : "PingRecovery";
  const emoji = failed ? "🚨" : "✅";
  const status = failed ? "Ping task failed" : "Ping task recovered";
  const defaultMessage = [
    status,
    `Task: ${taskLabel(task)}`,
    `Node: ${nodeLabel(nodeId, nodes)}`,
    `Target: ${task.target || "-"}`,
    failed
      ? `Consecutive failures: ${transition.streak}`
      : `Consecutive successes: ${transition.streak}`,
    `Checked at: ${transition.time}`,
  ].join("\n");
  const template = failed ? config.failure_template : config.recovery_template;
  const values: Record<string, string> = {
    task: taskLabel(task), task_id: String(task.id), node: nodeLabel(nodeId, nodes),
    uuid: nodeId, target: task.target || "-", count: String(transition.streak),
    time: transition.time, event, message: defaultMessage,
  };
  const message = typeof template === "string" && template.trim()
    ? template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => values[key] ?? match)
    : defaultMessage;

  await server.call("admin:sendNotification", {
    event: {
      event,
      emoji,
      message,
      time: new Date().toISOString(),
      clients: [{ uuid: nodeId }],
    },
  });
}

async function poll(): Promise<void> {
  if (polling) return;
  polling = true;
  try {
    const config = await server.getConfig<Config>();
    if (!asBoolean(config.enabled, true)) return;

    const failureThreshold = asInteger(config.failure_threshold, 10, 1, 1000);
    const recoveryThreshold = asInteger(config.recovery_threshold, 2, 1, 1000);
    const lookbackMinutes = asInteger(config.lookback_minutes, 10, 2, 14);
    const notifyRecovery = asBoolean(config.notify_recovery, true);
    const allTasks = asBoolean(config.all_tasks, true);
    const configuredTasks = selectedTaskIds(config.ping_tasks);
    const configuredNodes = selectedTaskIds(config.nodes);
    const [tasks, nodes] = await Promise.all([
      server.call<PingTask[]>("admin:getAllPingTasks"),
      nodeMap(),
    ]);

    const activeKeys = new Set<string>();
    for (const task of tasks ?? []) {
      if (task.id === undefined) continue;
      const taskId = String(task.id);
      if (!allTasks && !configuredTasks.has(taskId)) continue;
      const nodeIds = [...new Set(task.clients ?? [])].filter((id) => nodes.has(id) && (asBoolean(config.all_nodes, true) || configuredNodes.has(id)));
      if (nodeIds.length === 0) continue;
      for (const nodeId of nodeIds) activeKeys.add(monitorKey(taskId, nodeId));

      let samplesByNode: Map<string, Sample[]>;
      try {
        samplesByNode = await queryTaskSamples(taskId, nodeIds, lookbackMinutes);
      } catch (error) {
        console.warn(
          "ping-alert: query failed for task %s: %s",
          taskId,
          String(error),
        );
        continue;
      }

      for (const nodeId of nodeIds) {
        const key = monitorKey(taskId, nodeId);
        activeKeys.add(key);
        // First activation starts now by default; historical transient outages must not page users.
        const previous = state.entries[key] ?? {
          lastProcessedAt: asBoolean(config.startup_history, false) ? "" : new Date().toISOString(),
          failureStreak: 0, successStreak: 0, alertActive: false,
        };
        const result = processSamples(
          previous,
          samplesByNode.get(nodeId) ?? [],
          failureThreshold,
          recoveryThreshold,
          asInteger(config.max_gap_seconds, 0, 0, 86400) || Math.max(90, (task.interval || 60) * 3),
        );
        state.entries[key] = result.entry;
        for (const transition of result.transitions) {
          if (transition.type === "recovery" && !notifyRecovery) continue;
          state.pending ??= [];
          if (state.pending.length >= 1000) throw new Error("Notification outbox full; check channel configuration");
          state.pending.push({ transition, task, nodeId, attempts: 0, nextAttempt: 0 });
        }
      }
    }

    for (const key of Object.keys(state.entries)) {
      if (!activeKeys.has(key)) delete state.entries[key];
    }
    saveState();
    // Persist transitions before delivery. A failed call remains pending across restart.
    for (const pending of [...(state.pending ?? [])]) {
      if (pending.nextAttempt > Date.now()) continue;
      if (!activeKeys.has(monitorKey(String(pending.task.id), pending.nodeId))) {
        state.pending = state.pending?.filter((item) => item !== pending);
        saveState();
        continue;
      }
      try {
        await notify(pending.transition, pending.task, pending.nodeId, nodes, config);
        state.pending = state.pending?.filter((item) => item !== pending);
      } catch (error) {
        pending.attempts += 1;
        pending.nextAttempt = Date.now() + Math.min(3600, 30 * 2 ** Math.min(pending.attempts, 7)) * 1000;
        console.error("ping-alert: notification queued for retry: %s", String(error));
        saveState();
        break; // Preserve failure/recovery ordering.
      }
      saveState();
    }
  } catch (error) {
    console.error("ping-alert: poll failed: %s", String(error));
  } finally {
    polling = false;
  }
}

definePlugin({
  async load() {
    state = loadState();
    const config = await server.getConfig<Config>();
    server.cron(`@every ${asInteger(config.poll_seconds, 30, 5, 300)}s`, poll);
    await poll();
  },
});
