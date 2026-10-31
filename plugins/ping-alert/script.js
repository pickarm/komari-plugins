"use strict";
(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __commonJS = (cb, mod) => function __require2() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // node_modules/@komari-monitor/plugin-sdk/src/manifest.js
  var require_manifest = __commonJS({
    "node_modules/@komari-monitor/plugin-sdk/src/manifest.js"(exports, module) {
      "use strict";
      function isObject(value) {
        return value !== null && typeof value === "object" && !Array.isArray(value);
      }
      function hasText(value) {
        if (typeof value === "string") return value.trim().length > 0;
        if (!isObject(value)) return false;
        return Object.values(value).some((item) => typeof item === "string" && item.trim());
      }
      function isLocalPath(value) {
        if (typeof value !== "string" || !value) return false;
        const normalized = value.replaceAll("\\", "/");
        if (normalized.startsWith("/") || /^[A-Za-z]:\//.test(normalized)) return false;
        return !normalized.split("/").some((part) => part === "..") && normalized !== ".";
      }
      function validateManifest(manifest) {
        const errors = [];
        if (!isObject(manifest)) return ["manifest must be an object"];
        if (!hasText(manifest.name)) errors.push("name is required");
        if (typeof manifest.short !== "string" || !/^[A-Za-z0-9_-]+$/.test(manifest.short) || manifest.short === "default") {
          errors.push("short must contain only letters, digits, '_' and '-', and cannot be 'default'");
        }
        if (manifest.entry !== void 0 && !isLocalPath(manifest.entry)) {
          errors.push("entry must be a relative path inside the plugin directory");
        }
        if (manifest.icon !== void 0 && manifest.icon !== "" && !isLocalPath(manifest.icon)) {
          errors.push("icon must be a relative path inside the plugin directory");
        }
        if (manifest.version !== void 0 && typeof manifest.version !== "string") {
          errors.push("version must be a string");
        }
        if (manifest.komari !== void 0 && typeof manifest.komari !== "string") {
          errors.push("komari must be a string");
        }
        if (manifest.configuration !== void 0) {
          if (!isObject(manifest.configuration) || manifest.configuration.type !== "managed" || !Array.isArray(manifest.configuration.data)) {
            errors.push("configuration must be a managed configuration with a data array");
          } else {
            const itemTypes = /* @__PURE__ */ new Set(["string", "number", "select", "switch", "title", "textbox", "richtext", "nodes", "pingtasks"]);
            manifest.configuration.data.forEach((item, index) => {
              if (!isObject(item)) {
                errors.push(`configuration.data[${index}] must be an object`);
                return;
              }
              if (item.type !== "title" && item.type !== "textbox" && (typeof item.key !== "string" || !item.key.trim())) errors.push(`configuration.data[${index}].key is required`);
              if (!hasText(item.name)) errors.push(`configuration.data[${index}].name is required`);
              if (!itemTypes.has(item.type)) errors.push(`configuration.data[${index}].type is invalid`);
            });
          }
        }
        if (manifest.permissions !== void 0) {
          if (!isObject(manifest.permissions)) {
            errors.push("permissions must be an object");
          } else {
            const booleanKeys = [
              "node",
              "allowSystemRPC",
              "allowRoutes",
              "allowHooks",
              "allowHTMLInject",
              "allowExec",
              "allowListen",
              "allowAllFileAccess"
            ];
            for (const key of booleanKeys) {
              if (manifest.permissions[key] !== void 0 && typeof manifest.permissions[key] !== "boolean") {
                errors.push(`permissions.${key} must be a boolean`);
              }
            }
            for (const key of ["maxHTTPBodyBytes", "maxChildOutputBytes", "timeout"]) {
              if (manifest.permissions[key] !== void 0 && (!Number.isInteger(manifest.permissions[key]) || manifest.permissions[key] < 0)) {
                errors.push(`permissions.${key} must be a non-negative integer`);
              }
            }
          }
        }
        if (manifest.pages !== void 0) {
          if (!Array.isArray(manifest.pages)) {
            errors.push("pages must be an array");
          } else {
            manifest.pages.forEach((page, index) => {
              const prefix = `pages[${index}]`;
              if (!isObject(page)) {
                errors.push(`${prefix} must be an object`);
                return;
              }
              if (!hasText(page.title)) errors.push(`${prefix}.title is required`);
              const type = page.type || "iframe";
              const visibility = page.visibility || "admin";
              if (type !== "iframe" && type !== "redirect") errors.push(`${prefix}.type must be iframe or redirect`);
              if (visibility !== "admin" && visibility !== "public") errors.push(`${prefix}.visibility must be admin or public`);
              if (page.icon && !isLocalPath(page.icon)) errors.push(`${prefix}.icon must be a relative path`);
              if (type === "iframe" && !isLocalPath(page.file)) errors.push(`${prefix}.file must be a relative path`);
              if (type === "redirect" && !isSafeInternalPath(page.url)) errors.push(`${prefix}.url must be a safe internal path`);
            });
          }
        }
        return errors;
      }
      function isSafeInternalPath(value) {
        if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return false;
        if (value.includes("\\") || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)) return false;
        return !value.split("/").includes("..");
      }
      function assertValidManifest(manifest) {
        const errors = validateManifest(manifest);
        if (errors.length > 0) throw new Error(errors.join("; "));
        return manifest;
      }
      module.exports = { assertValidManifest, validateManifest };
    }
  });

  // node_modules/@komari-monitor/plugin-sdk/src/rpc.js
  var require_rpc = __commonJS({
    "node_modules/@komari-monitor/plugin-sdk/src/rpc.js"(exports, module) {
      "use strict";
      function createRpcClient(getServer) {
        const methods = (includeInternal = false) => getServer().call("rpc.methods", { internal: includeInternal });
        return {
          call(method, ...params) {
            return getServer().call(method, ...params);
          },
          methods,
          has(method) {
            return methods(true).then((registered) => registered.includes(method));
          },
          help(method) {
            return getServer().call("rpc.help", { method });
          }
        };
      }
      module.exports = { createRpcClient };
    }
  });

  // node_modules/@komari-monitor/plugin-sdk/schema/komari-plugin.schema.json
  var require_komari_plugin_schema = __commonJS({
    "node_modules/@komari-monitor/plugin-sdk/schema/komari-plugin.schema.json"(exports, module) {
      module.exports = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        $id: "https://komari-monitor.github.io/plugin-sdk/komari-plugin.schema.json",
        title: "Komari Plugin Manifest",
        description: "Komari plugin manifest.",
        type: "object",
        required: ["name", "short"],
        properties: {
          $schema: { type: "string", description: "Schema URL used for editor validation." },
          name: { $ref: "#/$defs/localizedText", description: "Display name shown in Komari." },
          short: { type: "string", pattern: "^(?!default$)[A-Za-z0-9_-]+$", description: "Stable plugin identifier used in routes and RPC names." },
          description: { $ref: "#/$defs/localizedText", description: "Human-readable plugin description." },
          author: { $ref: "#/$defs/localizedText", description: "Plugin author or organization." },
          version: { type: "string", description: "Plugin version." },
          url: { type: "string", format: "uri", description: "Project or documentation URL." },
          icon: { type: "string", description: "Icon URL or plugin-relative icon path." },
          komari: { type: "string", description: "Compatible Komari version constraint, such as `>=1.4.0`." },
          entry: { type: "string", default: "script.js", description: "Compiled plugin entry file, relative to the package root." },
          permissions: { $ref: "#/$defs/permissions", description: "Runtime permissions requested by the plugin." },
          configuration: {
            type: "object",
            required: ["type", "data"],
            properties: {
              type: { const: "managed", description: "Use Komari-managed configuration storage." },
              data: { type: "array", items: { $ref: "#/$defs/configurationItem" }, description: "Configuration items shown in the admin UI." }
            },
            additionalProperties: false,
            description: "Optional configuration schema rendered by Komari."
          },
          pages: { type: "array", items: { $ref: "#/$defs/page" }, description: "Admin or public pages contributed by the plugin." }
        },
        additionalProperties: false,
        $defs: {
          localizedText: {
            description: "A string or a language-to-string map.",
            oneOf: [
              { type: "string", minLength: 1 },
              { type: "object", minProperties: 1, additionalProperties: { type: "string" } }
            ]
          },
          permissions: {
            description: "Capabilities that must be approved before enabling the plugin.",
            type: "object",
            properties: {
              node: { type: "boolean", description: "Enable Node.js-compatible modules." },
              allowSystemRPC: { type: "boolean", description: "Allow calls to system RPC methods." },
              allowRoutes: { type: "boolean", description: "Allow HTTP routes and static files." },
              allowHooks: { type: "boolean", description: "Allow request and response hooks." },
              allowHTMLInject: { type: "boolean", description: "Allow HTML head/body injection." },
              allowExec: { type: "boolean", description: "Allow child process execution." },
              allowListen: { type: "boolean", description: "Allow the plugin to listen on a local port." },
              allowAllFileAccess: { type: "boolean", description: "Allow file access outside the plugin directory." },
              maxHTTPBodyBytes: { type: "integer", minimum: 0, description: "Maximum request body size in bytes." },
              maxChildOutputBytes: { type: "integer", minimum: 0, description: "Maximum captured child process output in bytes." },
              timeout: { type: "integer", minimum: 0, description: "Plugin execution timeout in seconds." }
            },
            additionalProperties: false
          },
          page: {
            description: "A page exposed by the plugin.",
            type: "object",
            required: ["title"],
            properties: {
              file: { type: "string", description: "Page file relative to the plugin package." },
              title: { $ref: "#/$defs/localizedText", description: "Page title shown in navigation." },
              icon: { type: "string", description: "Page icon name or URL." },
              type: { enum: ["iframe", "redirect"], description: "Page presentation mode." },
              url: { type: "string", description: "Target URL for redirect pages." },
              visibility: { enum: ["admin", "public"], description: "Whether the page is visible to admins or the public." }
            },
            additionalProperties: false
          },
          configurationItem: {
            description: "One managed configuration field.",
            type: "object",
            required: ["name", "type"],
            properties: {
              key: { type: "string", minLength: 1, description: "Stable configuration key." },
              name: { $ref: "#/$defs/localizedText", description: "Label shown in the configuration UI." },
              type: { enum: ["string", "number", "select", "switch", "title", "textbox", "richtext", "nodes", "pingtasks"], description: "Editor control type." },
              options: { type: "string", description: "Options for select controls." },
              default: { description: "Default value." },
              required: { type: "boolean", description: "Whether a value is required." },
              help: { $ref: "#/$defs/localizedText", description: "Help text shown below the field." }
            },
            allOf: [
              {
                if: { properties: { type: { enum: ["title", "textbox"] } } },
                then: {},
                else: { required: ["key"] }
              }
            ],
            additionalProperties: false
          }
        }
      };
    }
  });

  // node_modules/@komari-monitor/plugin-sdk/src/rpc-catalog.json
  var require_rpc_catalog = __commonJS({
    "node_modules/@komari-monitor/plugin-sdk/src/rpc-catalog.json"(exports, module) {
      module.exports = {
        komari: "1.4.x",
        "rpc.methods": { params: "{ internal?: boolean }", returns: "string[]" },
        "rpc.version": { params: "none", returns: "string" },
        "rpc.ping": { params: "none", returns: "string ('pong')" },
        "rpc.help": { params: "{ method?: string }", returns: "MethodMeta | MethodMeta[]" },
        "common:getNodes": { params: "{ uuid?: string }", returns: "Client | Record<string, Client>" },
        "common:getNodesLatestStatus": { params: "{ uuid?: string, uuids?: string[] }", returns: "Record<string, unknown>" },
        "common:getMe": { params: "none", returns: "CurrentUser" },
        "common:getPublicInfo": { params: "none", returns: "PublicInfo" },
        "common:getVersion": { params: "none", returns: "{ version: string, hash: string }" },
        "common:getNodeRecentStatus": { params: "{ uuid: string }", returns: "{ count: number, records: unknown[] }" },
        "common:getRecords": { params: "RecordQuery", returns: "RecordQueryResponse" },
        "public:getMe": { params: "none", returns: "CurrentUser" },
        "public:getNodesInformation": { params: "none", returns: "Client[]" },
        "public:getPublicSettings": { params: "none", returns: "PublicInfo" },
        "public:getVersion": { params: "none", returns: "{ version: string, hash: string }" },
        "public:getClientRecentRecords": { params: "{ uuid: string }", returns: "unknown" },
        "public:getRecordsByUUID": { params: "{ uuid: string, load_type?: string, hours?: string }", returns: "{ records: unknown[], count: number }" },
        "public:getPingRecords": { params: "{ uuid?: string, task_id?: string | number }", returns: "{ records: unknown[], count: number }" },
        "public:getPublicPingTasks": { params: "none", returns: "PingTask[]" },
        "public:recordVisitorEvent": { params: "{ event: string, action?: string, path?: string, route?: string, target?: string, detail?: object }", returns: "{ status: string }" },
        "public:listMetricDefinitions": { params: "none", returns: "MetricDefinition[]" },
        "public:queryMetrics": { params: "MetricQuery", returns: "MetricSeriesResponse" },
        "public:getPingMetricStats": { params: "PingMetricStatsQuery", returns: "PingMetricStatsResponse" },
        "admin:addClient": { params: "{ name?: string }", returns: "{ uuid: string, token: string }" },
        "admin:editClient": { params: "{ uuid: string, ...fields }", returns: "null" },
        "admin:removeClient": { params: "{ uuid: string }", returns: "null" },
        "admin:getClient": { params: "{ uuid: string }", returns: "Client" },
        "admin:listClients": { params: "none", returns: "Client[]" },
        "admin:getClientToken": { params: "{ uuid: string }", returns: "{ token: string }" },
        "admin:clearRecords": { params: "none", returns: "null" },
        "admin:getTasks": { params: "none", returns: "ExecTask[]" },
        "admin:getTaskById": { params: "{ task_id: string }", returns: "ExecTask" },
        "admin:getTasksByClientId": { params: "{ uuid: string }", returns: "ExecTask[]" },
        "admin:getSpecificTaskResult": { params: "{ task_id: string, uuid: string }", returns: "TaskResult" },
        "admin:getTaskResultsByTaskId": { params: "{ task_id: string }", returns: "TaskResult[]" },
        "admin:exec": { params: "{ command: string, clients: string[] }", returns: "{ task_id: string, clients: string[], queued_clients: string[] }" },
        "admin:addPingTask": { params: "AddPingTaskParams", returns: "{ task_id: number }" },
        "admin:deletePingTask": { params: "{ id: number[] }", returns: "null" },
        "admin:editPingTask": { params: "{ tasks: PingTask[] }", returns: "null" },
        "admin:getAllPingTasks": { params: "none", returns: "PingTask[]" },
        "admin:orderPingTask": { params: "Record<string, number>", returns: "null" },
        "admin:addLoadNotification": { params: "AddLoadNotificationParams", returns: "{ task_id: number }" },
        "admin:deleteLoadNotification": { params: "{ id: number[] }", returns: "null" },
        "admin:editLoadNotification": { params: "{ notifications: LoadNotification[] }", returns: "null" },
        "admin:getAllLoadNotifications": { params: "none", returns: "LoadNotification[]" },
        "admin:listOfflineNotifications": { params: "none", returns: "OfflineNotification[]" },
        "admin:editOfflineNotification": { params: "OfflineNotification[]", returns: "null" },
        "admin:enableOfflineNotification": { params: "string[]", returns: "null" },
        "admin:disableOfflineNotification": { params: "string[]", returns: "null" },
        "admin:listTrafficReportNotifications": { params: "none", returns: "TrafficReportNotification[]" },
        "admin:editTrafficReportNotifications": { params: "TrafficReportNotification[]", returns: "null" },
        "admin:enableTrafficReportNotifications": { params: "string[]", returns: "null" },
        "admin:disableTrafficReportNotifications": { params: "string[]", returns: "null" },
        "admin:sendNotification": { params: "{ event: { event?: any, message?: any, emoji?: any, time?: string, clients?: { uuid: string }[] } }", returns: "null" },
        "admin:getSessions": { params: "none", returns: "{ current: string, data: Session[] }" },
        "admin:deleteSession": { params: "{ session: string }", returns: "null" },
        "admin:deleteAllSessions": { params: "none", returns: "null" },
        "admin:getSettings": { params: "none", returns: "object" },
        "admin:editSettings": { params: "Record<string, unknown>", returns: "null | { restart_required: true, guide_path: string }" },
        "admin:clearAllRecords": { params: "none", returns: "null" },
        "admin:orderClients": { params: "Record<string, number>", returns: "null" },
        "admin:getLogs": { params: "{ limit?: string, page?: string, msg_type?: string }", returns: "{ logs: Log[], total: number }" },
        "admin:testSendMessage": { params: "none", returns: "null" },
        "admin:testGeoip": { params: "{ ip?: string }", returns: "GeoInfo" },
        "admin:listPlugins": { params: "none", returns: "PluginStatus[]" },
        "admin:setPluginEnabled": { params: "{ short: string, enabled: boolean, approved?: boolean }", returns: "null | { requires_approval: true }" },
        "admin:getPluginLogs": { params: "{ short: string }", returns: "{ logs: string }" },
        "admin:deletePlugin": { params: "{ short: string }", returns: "null" },
        "admin:getPluginConfiguration": { params: "{ short: string }", returns: "{ configuration: object, data: object }" },
        "admin:setPluginConfiguration": { params: "{ short: string, data: object }", returns: "null" },
        "admin:getXtermjsSettings": { params: "none", returns: "XtermJSSettings" },
        "admin:setXtermjsSettings": { params: "XtermJSSettings", returns: "XtermJSSettings" },
        "admin:getMessageSenderProvider": { params: "{ provider?: string }", returns: "MessageSenderProvider | MessageSenderProvider[]" },
        "admin:setMessageSenderProvider": { params: "MessageSenderProvider", returns: "{ message: string }" },
        "admin:getOidcProvider": { params: "{ provider?: string }", returns: "OidcProvider | OidcProvider[]" },
        "admin:setOidcProvider": { params: "OidcProvider", returns: "{ message: string }" },
        "admin:getClipboard": { params: "{ id: string }", returns: "Clipboard" },
        "admin:listClipboard": { params: "none", returns: "Clipboard[]" },
        "admin:createClipboard": { params: "Clipboard", returns: "Clipboard" },
        "admin:updateClipboard": { params: "Clipboard", returns: "Clipboard" },
        "admin:deleteClipboard": { params: "{ id: string }", returns: "null" },
        "admin:batchDeleteClipboard": { params: "{ ids: string[] }", returns: "null" },
        "admin:getDatabaseSize": { params: "none", returns: "DatabaseStatus" },
        "admin:vacuumDatabase": { params: "none", returns: "DatabaseMaintenanceResponse" },
        "admin:dbQuery": { params: '{ database?: "main" | "metrics", sql: string, args?: any[], limit?: number }', returns: "DatabaseQueryResult" },
        "admin:dbExec": { params: '{ database?: "main" | "metrics", sql: string, args?: any[] }', returns: "DatabaseExecResult" },
        "admin:dbTables": { params: '{ database?: "main" | "metrics" }', returns: "DatabaseTablesResult" },
        "admin:listMetricDefinitions": { params: "none", returns: "MetricDefinition[]" },
        "admin:updateMetricDefinition": { params: "{ name: string, retention_days: number }", returns: "MetricDefinition" },
        "admin:getMetricMigrationStatus": { params: "none", returns: "MetricMigrationStatus" },
        "admin:startMetricMigration": { params: "{ source_driver?: string, source_dsn?: string }", returns: "{ status: string, message: string }" },
        "admin:cancelMetricMigration": { params: "none", returns: "{ status: string, message: string }" },
        "client:getPingTasks": { params: "none", returns: "PingTask[]" },
        "client:uploadPingResult": { params: "UploadPingResultParams", returns: "{ status: string }" },
        "client:taskResult": { params: "TaskResultParams", returns: "{ status: string, message: string }" }
      };
    }
  });

  // node_modules/@komari-monitor/plugin-sdk/src/index.js
  var require_src = __commonJS({
    "node_modules/@komari-monitor/plugin-sdk/src/index.js"(exports, module) {
      "use strict";
      var { assertValidManifest, validateManifest } = require_manifest();
      var { createRpcClient } = require_rpc();
      var manifestSchema = require_komari_plugin_schema();
      var rpcCatalog = require_rpc_catalog();
      var cachedServer;
      function getServer() {
        if (!cachedServer) {
          cachedServer = __require("server");
        }
        return cachedServer;
      }
      function definePlugin2(definition) {
        if (!definition || typeof definition !== "object") {
          throw new TypeError("definePlugin requires a plugin definition object");
        }
        const load = typeof definition.load === "function" ? definition.load : () => {
        };
        const unload = typeof definition.unload === "function" ? definition.unload : () => {
        };
        globalThis.load = load;
        globalThis.unload = unload;
        return definition;
      }
      function jsonResponse(res, value, statusCode = 200) {
        res.statusCode = statusCode;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify(value));
        return res;
      }
      function textResponse(res, value, statusCode = 200, contentType = "text/plain; charset=utf-8") {
        res.statusCode = statusCode;
        res.setHeader("Content-Type", contentType);
        res.end(String(value));
        return res;
      }
      var exportsObject = {
        assertValidManifest,
        definePlugin: definePlugin2,
        jsonResponse,
        manifestSchema,
        rpc: createRpcClient(getServer),
        rpcCatalog,
        textResponse,
        validateManifest
      };
      Object.defineProperty(exportsObject, "server", {
        enumerable: true,
        get: getServer
      });
      module.exports = exportsObject;
    }
  });

  // src/plugin.ts
  var import_plugin_sdk = __toESM(require_src());

  // src/config.ts
  var bool = (v, fallback) => typeof v === "boolean" ? v : fallback;
  var str = (v, fallback = "") => typeof v === "string" ? v : fallback;
  function number(v, fallback, min, max) {
    const n = Number(v);
    return v == null || v === "" || !Number.isFinite(n) ? fallback : Math.max(min, Math.min(max, n));
  }
  var integer = (v, fallback, min, max) => Math.trunc(number(v, fallback, min, max));
  var ids = (v) => new Set(Array.isArray(v) ? v.map(String) : []);
  function rules(c) {
    const failureMs = number(c.failure_latency_ms, 200, 1e-3, 6e5);
    const lossHigh = number(c.loss_failure_percent, 20, 1e-3, 100);
    return {
      failureCount: integer(c.failure_threshold, 10, 1, 1e3),
      recoveryCount: integer(c.recovery_threshold, 2, 1, 1e3),
      latencyEnabled: bool(c.latency_enabled, false),
      failureMs,
      recoveryMs: Math.min(failureMs, number(c.recovery_latency_ms, 150, 0, 6e5)),
      lossEnabled: bool(c.loss_enabled, false),
      lossWindow: integer(c.loss_window_probes, 20, 2, 1e3),
      lossHigh,
      lossLow: Math.min(lossHigh, number(c.loss_recovery_percent, 5, 0, 100)),
      lossFailureCount: integer(c.loss_failure_probes, 1, 1, 1e3),
      lossRecoveryCount: integer(c.loss_recovery_probes, 2, 1, 1e3)
    };
  }

  // src/monitor.ts
  function freshMonitor(time, old) {
    return {
      last: time,
      ping: { active: old?.ping.active ?? false, bad: 0, good: 0 },
      loss: { active: old?.loss.active ?? false, bad: 0, good: 0 },
      window: []
    };
  }
  function advance(s, bad, good, failN, recoverN) {
    s.bad = bad ? Math.min(failN, s.bad + 1) : 0;
    s.good = good ? Math.min(recoverN, s.good + 1) : 0;
    if (!s.active && s.bad >= failN) {
      s.active = true;
      s.good = 0;
      return false;
    }
    if (s.active && s.good >= recoverN) {
      s.active = false;
      s.bad = 0;
      return true;
    }
    return null;
  }
  function processProbes(previous, probes, r, maxGapSeconds) {
    const state2 = JSON.parse(JSON.stringify(previous));
    const changes = [];
    for (const p of [...probes].sort((a, b) => Date.parse(a.time) - Date.parse(b.time))) {
      const ts = Date.parse(p.time);
      if (!Number.isFinite(ts) || ts <= Date.parse(state2.last) || typeof p.value !== "number" || !Number.isFinite(p.value)) continue;
      if (ts - Date.parse(state2.last) > maxGapSeconds * 1e3) {
        state2.ping.bad = state2.ping.good = state2.loss.bad = state2.loss.good = 0;
        state2.window = [];
      }
      state2.last = p.time;
      const timeout = p.value < 0;
      state2.window.push(timeout ? 1 : 0);
      state2.window = state2.window.slice(-r.lossWindow);
      const loss = state2.window.length === r.lossWindow ? state2.window.reduce((a, b) => a + b, 0) / r.lossWindow * 100 : null;
      const pingChange = advance(
        state2.ping,
        timeout || r.latencyEnabled && p.value > r.failureMs,
        !timeout && (!r.latencyEnabled || p.value <= r.recoveryMs),
        r.failureCount,
        r.recoveryCount
      );
      if (pingChange !== null) changes.push({
        rule: "ping",
        recovered: pingChange,
        time: p.time,
        count: pingChange ? r.recoveryCount : r.failureCount,
        latency: p.value,
        lossPercent: loss
      });
      if (r.lossEnabled && loss !== null) {
        const lossChange = advance(
          state2.loss,
          loss >= r.lossHigh,
          loss <= r.lossLow && loss < r.lossHigh,
          r.lossFailureCount,
          r.lossRecoveryCount
        );
        if (lossChange !== null) changes.push({
          rule: "loss",
          recovered: lossChange,
          time: p.time,
          count: lossChange ? r.lossRecoveryCount : r.lossFailureCount,
          latency: p.value,
          lossPercent: loss
        });
      } else if (!r.lossEnabled) state2.loss = { active: false, bad: 0, good: 0 };
    }
    return { state: state2, changes };
  }

  // src/reports.ts
  function reportRange(kind, now, customHours = 6) {
    if (kind === "custom") return { start: new Date(now.getTime() - customHours * 36e5), end: now };
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(end);
    if (kind === "daily") start.setDate(start.getDate() - 1);
    if (kind === "weekly") {
      end.setDate(end.getDate() - (end.getDay() + 6) % 7);
      start.setTime(end.getTime());
      start.setDate(start.getDate() - 7);
    }
    if (kind === "monthly") {
      end.setDate(1);
      start.setTime(end.getTime());
      start.setMonth(start.getMonth() - 1);
    }
    return { start, end };
  }
  function summarize(stats) {
    let total = 0, lost = 0, valid = 0, latencySum = 0;
    let approximate = false;
    for (const s of stats) {
      if (!Number.isFinite(s.total) || s.total <= 0 || !Number.isFinite(s.loss)) continue;
      total += s.total;
      lost += s.total * s.loss / 100;
      approximate || (approximate = !!s.loss_approximate);
      if (typeof s.avg === "number" && Number.isFinite(s.avg) && s.avg >= 0 && s.valid > 0) {
        valid += s.valid;
        latencySum += s.avg * s.valid;
      }
    }
    return {
      total,
      averageLatency: valid ? latencySum / valid : null,
      averageLoss: total ? lost / total * 100 : null,
      approximate
    };
  }
  var latencyText = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0 ? `${v.toFixed(2)} ms` : "\u65E0\u6210\u529F\u91C7\u6837";
  var lossText = (v) => v === null ? "\u65E0\u6570\u636E" : `${v.toFixed(2)}%`;

  // src/plugin.ts
  var fs = __require("fs");
  var stateFile = `${__storageDir__}/state-v2.json`;
  var state;
  var sessionStart;
  var chain = Promise.resolve();
  var jobs = /* @__PURE__ */ new Set();
  function save() {
    fs.mkdirSync(__storageDir__, { recursive: true });
    fs.writeFileSync(`${stateFile}.tmp`, JSON.stringify(state), "utf8");
    fs.renameSync(`${stateFile}.tmp`, stateFile);
  }
  function readState() {
    if (!fs.existsSync(stateFile)) {
      const initial = { version: 2, entries: {}, pending: [], reports: {}, requests: [] };
      const legacyPath = `${__storageDir__}/state.json`;
      if (fs.existsSync(legacyPath)) {
        const legacy = JSON.parse(fs.readFileSync(legacyPath, "utf8"));
        for (const [key, old] of Object.entries(legacy.entries ?? {})) {
          const monitor = freshMonitor(sessionStart);
          monitor.ping.active = old.alertActive === true;
          initial.entries[key] = monitor;
        }
        if (legacy.pending?.length) console.warn("ping-alert: legacy queued notifications remain in state.json; history replay disabled in v1.1");
      }
      return initial;
    }
    const parsed = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    if (parsed.version !== 2 || !parsed.entries || !Array.isArray(parsed.pending) || !parsed.reports) throw new Error("Invalid persistent plugin state; restore state-v2.json from backup");
    parsed.requests ?? (parsed.requests = []);
    return parsed;
  }
  function job(key, fn) {
    return () => {
      if (jobs.has(key)) return chain;
      jobs.add(key);
      chain = chain.then(fn).catch((e) => console.error("ping-alert %s: %s", key, String(e))).finally(() => jobs.delete(key));
      return chain;
    };
  }
  function put(id, scope2, payload) {
    if (state.pending.some((p) => p.id === id)) return;
    if (state.pending.length >= 1e3) throw new Error("Notification queue full; check notification channels");
    state.pending.push({ id, scope: scope2, payload, attempts: 0, next: 0 });
  }
  async function flush(c) {
    const blocked = /* @__PURE__ */ new Set();
    for (const p of [...state.pending]) {
      if (blocked.has(p.scope)) continue;
      if (p.next > Date.now()) {
        blocked.add(p.scope);
        continue;
      }
      if (p.scope.startsWith("alert:") && !bool(c.enabled, true) || p.scope.startsWith("report:") && !bool(c[`${p.scope.slice(7)}_enabled`], false)) continue;
      try {
        await import_plugin_sdk.server.call("admin:sendNotification", { event: p.payload });
        state.pending = state.pending.filter((item) => item.id !== p.id);
      } catch (e) {
        p.attempts++;
        p.next = Date.now() + Math.min(36e5, 3e4 * 2 ** Math.min(p.attempts, 7));
        blocked.add(p.scope);
        console.error("ping-alert: delivery queued for retry: %s", String(e));
      }
      save();
    }
  }
  async function scope(c) {
    const [allTasks, nodes] = await Promise.all([
      import_plugin_sdk.server.call("admin:getAllPingTasks"),
      import_plugin_sdk.server.call("common:getNodes")
    ]);
    const selectedTasks = ids(c.ping_tasks), selectedNodes = ids(c.nodes);
    return { nodes, tasks: allTasks.filter((t) => bool(c.all_tasks, true) || selectedTasks.has(String(t.id))).map((t) => ({
      ...t,
      clients: [...new Set(t.clients ?? [])].filter((id) => nodes[id] && (bool(c.all_nodes, true) || selectedNodes.has(id)))
    })).filter((t) => t.clients.length) };
  }
  function alertEvent(change, task, uuid, nodes, c) {
    const event = change.rule === "ping" ? change.recovered ? "PingRecovery" : "PingFailure" : change.recovered ? "PingLossRecovery" : "PingLossFailure";
    const title = `${change.rule === "ping" ? "Ping \u63A2\u6D4B" : "Ping \u4E22\u5305\u7387"}${change.recovered ? "\u6062\u590D" : "\u5F02\u5E38"}`;
    const message = [
      title,
      `\u4EFB\u52A1\uFF1A${task.name || task.id}`,
      `\u8282\u70B9\uFF1A${nodes[uuid]?.name || uuid}`,
      `\u76EE\u6807\uFF1A${task.target || "-"}`,
      `\u8FDE\u7EED${change.recovered ? "\u6062\u590D" : "\u5F02\u5E38"}\u63A2\u6D4B\uFF1A${change.count} \u6B21`,
      `\u672C\u6B21\u5EF6\u8FDF\uFF1A${change.latency < 0 ? "\u8D85\u65F6/\u5931\u8D25" : latencyText(change.latency)}`,
      `\u6700\u8FD1 ${rules(c).lossWindow} \u6B21\u4E22\u5305\u7387\uFF1A${lossText(change.lossPercent)}`,
      `\u63A2\u6D4B\u65F6\u95F4\uFF1A${change.time}`
    ].join("\n");
    const values = {
      task: task.name || String(task.id),
      task_id: String(task.id),
      node: nodes[uuid]?.name || uuid,
      uuid,
      target: task.target || "-",
      count: String(change.count),
      latency: change.latency < 0 ? "\u8D85\u65F6/\u5931\u8D25" : latencyText(change.latency),
      loss: lossText(change.lossPercent),
      time: change.time,
      event,
      message
    };
    const template = str(change.recovered ? c.recovery_template : c.failure_template);
    return {
      event,
      emoji: change.recovered ? "\u2705" : "\u{1F6A8}",
      time: change.time,
      clients: [{ uuid }],
      message: template.trim() ? template.replace(/\{\{(\w+)\}\}/g, (m, k) => values[k] ?? m) : message
    };
  }
  async function poll() {
    const c = await import_plugin_sdk.server.getConfig();
    if (!bool(c.enabled, true)) {
      await flush(c);
      await drainReports();
      return;
    }
    const r = rules(c), selected = await scope(c), active = /* @__PURE__ */ new Set();
    for (const task of selected.tasks) {
      for (const uuid of task.clients) active.add(`${task.id}:${uuid}`);
      const end = /* @__PURE__ */ new Date();
      const cursor = Math.min(...task.clients.map((uuid) => Date.parse(state.entries[`${task.id}:${uuid}`]?.last || sessionStart)));
      const start = new Date(Math.max(Date.parse(sessionStart), cursor - 1, end.getTime() - 3e5));
      if (start >= end) continue;
      try {
        const response = await import_plugin_sdk.server.call("public:queryMetrics", {
          metric_keys: ["ping.latency_ms"],
          tags: { task_id: String(task.id) },
          entity_ids: task.clients,
          start: start.toISOString(),
          end: end.toISOString(),
          fill_empty: false,
          max_points: 1e4
        });
        const series = response.series ?? [];
        if (series.some((s) => s.downsampled !== false)) throw new Error("Aggregated data rejected: raw probes required");
        const byNode = new Map(series.map((s) => [s.entity_id, s.points ?? []]));
        for (const uuid of task.clients) {
          const key = `${task.id}:${uuid}`;
          const previous = state.entries[key] || freshMonitor(sessionStart);
          const result = processProbes(previous, byNode.get(uuid) ?? [], r, Math.max(90, (task.interval || 60) * 3));
          for (const change of result.changes) {
            if (change.recovered && !bool(c.notify_recovery, true)) continue;
            put(
              `${key}:${change.rule}:${change.time}:${change.recovered}`,
              `alert:${key}:${change.rule}`,
              alertEvent(change, task, uuid, selected.nodes, c)
            );
          }
          state.entries[key] = result.state;
        }
      } catch (e) {
        console.error("ping-alert task %s: %s", task.id, String(e));
      }
    }
    for (const key of Object.keys(state.entries)) if (!active.has(key)) delete state.entries[key];
    state.pending = state.pending.filter((p) => !p.scope.startsWith("alert:") || active.has(p.scope.split(":").slice(1, 3).join(":")) && (!p.scope.endsWith(":loss") || r.lossEnabled));
    save();
    await flush(c);
    await drainReports();
  }
  async function report(request) {
    const { kind } = request;
    const c = await import_plugin_sdk.server.getConfig();
    if (!bool(c[`${kind}_enabled`], false)) return;
    const start = new Date(request.start), end = new Date(request.end);
    const rangeKey = `${start.toISOString()}/${end.toISOString()}`;
    if (state.reports[kind] === rangeKey) return;
    const { tasks, nodes } = await scope(c);
    const lines = [], allStats = [];
    for (const task of tasks) {
      const response = await import_plugin_sdk.server.call("public:getPingMetricStats", {
        entity_ids: task.clients,
        task_ids: [task.id],
        start: start.toISOString(),
        end: new Date(end.getTime() - 1).toISOString(),
        max_points: 1e4
      });
      const matching = response.stats.filter((s) => String(s.task_id) === String(task.id) && task.clients.includes(s.entity_id));
      allStats.push(...matching);
      for (const uuid of task.clients) {
        const stat = matching.find((s) => s.entity_id === uuid);
        lines.push(`${task.name || task.id} / ${nodes[uuid]?.name || uuid}\uFF1A${stat && stat.total > 0 ? `\u5E73\u5747\u5EF6\u8FDF ${latencyText(stat.avg)}\uFF0C\u5E73\u5747\u4E22\u5305\u7387 ${lossText(stat.loss)}${stat.loss_approximate ? "\uFF08\u4F30\u7B97\uFF09" : ""}\uFF0C${stat.total} \u6B21\u63A2\u6D4B` : "\u65E0\u6570\u636E"}`);
      }
    }
    const totals = summarize(allStats);
    const label = { daily: "\u65E5\u62A5", weekly: "\u5468\u62A5", monthly: "\u6708\u62A5", custom: "\u81EA\u5B9A\u4E49\u5468\u671F\u62A5\u544A" }[kind];
    const event = `Ping${kind[0].toUpperCase()}${kind.slice(1)}Report`;
    const message = [
      `Ping ${label}`,
      `${start.toISOString()} \u81F3 ${end.toISOString()}\uFF08\u4E0D\u542B\u7EC8\u70B9\uFF09`,
      `\u603B\u4F53\u5E73\u5747\u5EF6\u8FDF\uFF1A${totals.total ? latencyText(totals.averageLatency) : "\u65E0\u6570\u636E"}`,
      `\u603B\u4F53\u5E73\u5747\u4E22\u5305\u7387\uFF1A${lossText(totals.averageLoss)}${totals.approximate ? "\uFF08\u542B\u4F30\u7B97\uFF09" : ""}`,
      `\u5B9E\u9645\u63A2\u6D4B\u603B\u6570\uFF1A${totals.total}`,
      ...lines,
      "\u7EDF\u8BA1\u6E90\uFF1AKomari \u5386\u53F2\u805A\u5408\u6570\u636E\uFF1B\u7F3A\u62A5\u4E0D\u8BA1\u4E3A\u4E22\u5305\uFF0C\u4FDD\u5B58\u671F\u4E0D\u8DB3\u65F6\u53EA\u8986\u76D6\u73B0\u5B58\u6570\u636E\u3002"
    ].join("\n");
    const id = `report:${kind}:${rangeKey}`;
    put(id, `report:${kind}`, { event, message, emoji: "\u{1F4CA}", time: (/* @__PURE__ */ new Date()).toISOString() });
    state.reports[kind] = rangeKey;
    save();
    await flush(c);
  }
  async function drainReports() {
    const request = state.requests.find((r) => r.next <= Date.now());
    if (!request) return;
    try {
      await report(request);
      state.requests = state.requests.filter((r) => r !== request);
    } catch (e) {
      request.attempts++;
      request.next = Date.now() + Math.min(36e5, 3e4 * 2 ** Math.min(request.attempts, 7));
      console.error("ping-alert report queued for retry: %s", String(e));
    }
    save();
  }
  async function requestReport(kind) {
    const c = await import_plugin_sdk.server.getConfig();
    if (!bool(c[`${kind}_enabled`], false)) return;
    const { start, end } = reportRange(kind, /* @__PURE__ */ new Date(), number(c.custom_hours, 6, 0.05, 8760));
    const startText = start.toISOString(), endText = end.toISOString();
    if (state.reports[kind] === `${startText}/${endText}` || state.requests.some((r) => r.kind === kind && r.start === startText && r.end === endText)) return;
    if (state.requests.length >= 100) throw new Error("Report request queue full; check metrics API");
    state.requests.push({ kind, start: startText, end: endText, next: 0, attempts: 0 });
    save();
    await drainReports();
  }
  (0, import_plugin_sdk.definePlugin)({
    async load() {
      sessionStart = (/* @__PURE__ */ new Date()).toISOString();
      state = readState();
      for (const [key, old] of Object.entries(state.entries)) state.entries[key] = freshMonitor(sessionStart, old);
      save();
      import_plugin_sdk.server.cron("@every 10s", job("poll", poll));
      const c = await import_plugin_sdk.server.getConfig();
      const schedules = { daily: "0 9 * * *", weekly: "0 9 * * 1", monthly: "0 9 1 * *", custom: "0 */6 * * *" };
      for (const kind of Object.keys(schedules)) {
        if (!bool(c[`${kind}_enabled`], false)) continue;
        try {
          import_plugin_sdk.server.cron(str(c[`${kind}_cron`], schedules[kind]).trim(), job(`report-${kind}`, () => requestReport(kind)));
        } catch (e) {
          console.error("ping-alert invalid %s report schedule: %s", kind, String(e));
        }
      }
      await job("poll", poll)();
    }
  });
})();
