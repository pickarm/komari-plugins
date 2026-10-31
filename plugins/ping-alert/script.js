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
    const failureValue = number(c.failure_delay_ms, -1, -1, 6e5);
    const failureMs = failureValue < 0 ? -1 : failureValue;
    const recoveryText = c.recovery_delay_ms;
    const recoveryNumber = Number(recoveryText);
    const recoveryMs = recoveryText == null || recoveryText === "" || recoveryText === "\u4E0D\u9650" || !Number.isFinite(recoveryNumber) || recoveryNumber < 0 ? null : Math.min(recoveryNumber, 6e5);
    const lossHigh = number(c.loss_failure_percent, 20, 1e-3, 100);
    return {
      pingEnabled: bool(c.enabled, true),
      failureCount: integer(c.failure_threshold, 10, 1, 1e3),
      recoveryCount: integer(c.recovery_threshold, 2, 1, 1e3),
      failureMs,
      recoveryMs,
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
      const failed = p.value === -1 || r.failureMs >= 0 && p.value > r.failureMs;
      const recovered = !failed && (r.recoveryMs === null || p.value <= r.recoveryMs);
      const pingChange = r.pingEnabled ? advance(
        state2.ping,
        failed,
        recovered,
        r.failureCount,
        r.recoveryCount
      ) : null;
      if (!r.pingEnabled) state2.ping = { active: false, bad: 0, good: 0 };
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

  // src/notifications.ts
  var reportMetrics = (c) => ({ ping: bool(c.enabled, true), loss: bool(c.loss_enabled, false) });
  var metricKey = (c) => {
    const f = reportMetrics(c);
    return `${f.ping ? "p" : ""}${f.loss ? "l" : ""}`;
  };
  var htmlEscape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  function plainText(s) {
    return s.replace(/\r\n?/g, "\n").replace(/<br\s*\/?\s*>/gi, "\n").replace(/<\/(?:p|div|li|h[1-6]|blockquote)>/gi, "\n").replace(/<\/?(?:p|div|li|ul|ol|h[1-6]|blockquote|strong|b|em|i|u|s|span|pre|code|a)(?:\s[^>]*?)?>/gi, "").replace(/&nbsp;/gi, " ").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&amp;/gi, "&").replace(/\n[ \t]+/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  function localTime(iso, c) {
    const offset = number(c.notice_utc_offset, 8, -12, 14), d = new Date(Date.parse(iso) + offset * 36e5);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}\uFF08UTC${offset >= 0 ? "+" : ""}${offset}\uFF09`;
  }
  function prepareNotice(event, settings) {
    const outer = str(settings.notification_template, "{{emoji}}{{emoji}}{{emoji}}\nEvent: {{event}}\nClients: {{client}}\nMessage: {{message}}\nTime: {{time}}");
    const telegram = str(settings.notification_method) === "telegram";
    let body = event.message.replace(/\r\n?/g, "\n").trim();
    if (outer.includes("{{event}}") || telegram) {
      if (body.startsWith(event.event + "\n")) body = body.slice(event.event.length + 1);
    }
    if (event.clients?.length && /\{\{clients?\}\}/.test(outer)) body = body.split("\n").filter((l) => !l.startsWith("\u8282\u70B9\uFF1A")).join("\n");
    if (outer.includes("{{time}}")) body = body.split("\n").filter((l) => !l.startsWith("\u63A2\u6D4B\u65F6\u95F4\uFF1A") && !l.startsWith("\u901A\u77E5\u65F6\u95F4\uFF1A")).join("\n");
    const payload = { ...event, message: telegram ? htmlEscape(body) : body };
    const d = new Date(event.time), pad = (n) => String(n).padStart(2, "0");
    const time = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    const values = { emoji: event.emoji, event: event.event, client: event.clientLabel || "", clients: event.clientLabel || "", message: payload.message, time };
    const rendered = outer.replace(/\{\{(emoji|event|clients?|message|time)\}\}/g, (_, k) => values[k]);
    const wire = telegram ? `<b>${htmlEscape(event.event)}</b>
${rendered}` : rendered;
    return {
      payload,
      preview: plainText(wire),
      raw: wire,
      channel: str(settings.notification_method, "none"),
      ready: bool(settings.notification_enabled, false) && !["", "none"].includes(str(settings.notification_method, "none"))
    };
  }

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
      if (p.scope.startsWith("alert:") && !(p.scope.endsWith(":loss") ? bool(c.loss_enabled, false) : bool(c.enabled, true)) || p.scope.startsWith("report:") && (!bool(c[`${p.scope.slice(7)}_enabled`], false) || !metricKey(c) || p.payload.metrics !== metricKey(c))) {
        state.pending = state.pending.filter((item) => item.id !== p.id);
        save();
        continue;
      }
      try {
        await deliver(p.payload);
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
    const code = change.rule === "ping" ? change.recovered ? "PingRecovery" : "PingFailure" : change.recovered ? "PingLossRecovery" : "PingLossFailure";
    const event = `${change.rule === "ping" ? "\u63A2\u6D4B" : "\u4E22\u5305\u7387"}${change.recovered ? "\u6062\u590D" : "\u5F02\u5E38"}`;
    const flags = reportMetrics(c);
    const message = [
      event,
      `\u4EFB\u52A1\uFF1A${task.name || task.id}`,
      `\u8282\u70B9\uFF1A${nodes[uuid]?.name || uuid}`,
      `\u76EE\u6807\uFF1A${task.target || "-"}`,
      `\u8FDE\u7EED${change.recovered ? "\u6062\u590D" : "\u5F02\u5E38"}\u63A2\u6D4B\uFF1A${change.count} \u6B21`,
      ...flags.ping ? [`\u672C\u6B21\u5EF6\u8FDF\uFF1A${change.latency === -1 ? "-1\uFF08\u63A2\u6D4B\u5931\u8D25\uFF09" : `${change.latency.toFixed(2)} ms`}`] : [],
      ...flags.loss ? [`\u6700\u8FD1 ${rules(c).lossWindow} \u6B21\u4E22\u5305\u7387\uFF1A${lossText(change.lossPercent)}`] : [],
      `\u63A2\u6D4B\u65F6\u95F4\uFF1A${localTime(change.time, c)}`
    ].join("\n");
    const values = {
      task: task.name || String(task.id),
      task_id: String(task.id),
      node: nodes[uuid]?.name || uuid,
      uuid,
      target: task.target || "-",
      count: String(change.count),
      latency: change.latency === -1 ? "-1\uFF08\u63A2\u6D4B\u5931\u8D25\uFF09" : `${change.latency.toFixed(2)} ms`,
      loss: lossText(change.lossPercent),
      time: localTime(change.time, c),
      event,
      event_code: code,
      message
    };
    const template = str(change.recovered ? c.recovery_template : c.failure_template);
    return {
      event,
      code,
      emoji: change.recovered ? "\u2705" : "\u{1F6A8}",
      time: change.time,
      clients: [{ uuid }],
      clientLabel: nodes[uuid]?.name || uuid,
      message: template.trim() ? plainText(template).replace(/\{\{(\w+)\}\}/g, (m, k) => values[k] ?? m) : message
    };
  }
  async function deliveryPreview(payload) {
    const s = await import_plugin_sdk.server.call("admin:getSettings");
    return prepareNotice(payload, { notification_method: s.notification_method, notification_template: s.notification_template, notification_enabled: s.notification_enabled });
  }
  async function deliver(payload) {
    const prepared = await deliveryPreview(payload);
    if (!prepared.ready) throw new Error("\u8BF7\u5148\u5F00\u542F Komari \u901A\u77E5\u5E76\u9009\u62E9\u901A\u77E5\u6E20\u9053");
    await import_plugin_sdk.server.call("admin:sendNotification", { event: prepared.payload });
  }
  async function poll() {
    const c = await import_plugin_sdk.server.getConfig();
    if (!metricKey(c)) {
      state.entries = {};
      state.requests = [];
      await flush(c);
      save();
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
    state.pending = state.pending.filter((p) => !p.scope.startsWith("alert:") || active.has(p.scope.split(":").slice(1, 3).join(":")) && (p.scope.endsWith(":loss") ? r.lossEnabled : r.pingEnabled));
    save();
    await flush(c);
    await drainReports();
  }
  async function report(request) {
    const { kind } = request;
    const c = await import_plugin_sdk.server.getConfig();
    if (!bool(c[`${kind}_enabled`], false) || !metricKey(c)) return;
    const start = new Date(request.start), end = new Date(request.end);
    const rangeKey = `${start.toISOString()}/${end.toISOString()}`;
    if (state.reports[kind] === rangeKey) return;
    const { tasks, nodes } = await scope(c);
    const allStats = [];
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
    }
    const payload = reportEvent(c, kind, start, end, tasks, nodes, allStats);
    if (!payload) return;
    const id = `report:${kind}:${rangeKey}`;
    put(id, `report:${kind}`, payload);
    state.reports[kind] = rangeKey;
    save();
    await flush(c);
  }
  function reportEvent(c, kind, start, end, tasks, nodes, allStats) {
    const flags = reportMetrics(c);
    if (!flags.ping && !flags.loss) return null;
    const totals = summarize(allStats), lines = [];
    for (const task of tasks) for (const uuid of task.clients ?? []) {
      const stat = allStats.find((s) => String(s.task_id) === String(task.id) && s.entity_id === uuid);
      const metrics = stat && stat.total > 0 ? [
        ...flags.ping ? [`\u5E73\u5747\u5EF6\u8FDF\uFF1A${latencyText(stat.avg)}`] : [],
        ...flags.loss ? [`\u5E73\u5747\u4E22\u5305\u7387\uFF1A${lossText(stat.loss)}${stat.loss_approximate ? "\uFF08\u4F30\u7B97\uFF09" : ""}`] : [],
        `\u5B9E\u9645\u63A2\u6D4B\uFF1A${stat.total} \u6B21`
      ] : ["\u65E0\u6570\u636E"];
      lines.push(`\u4EFB\u52A1\uFF1A${task.name || task.id}
\u8282\u70B9\uFF1A${nodes[uuid]?.name || uuid}
${metrics.join("\n")}`);
    }
    const label = { daily: "\u65E5\u62A5", weekly: "\u5468\u62A5", monthly: "\u6708\u62A5", custom: "\u81EA\u5B9A\u4E49\u5468\u671F\u62A5\u544A" }[kind];
    const event = `\u63A2\u6D4B${label}`, code = `Ping${kind[0].toUpperCase()}${kind.slice(1)}Report`;
    const message = [
      event,
      `\u7EDF\u8BA1\u5F00\u59CB\uFF1A${localTime(start.toISOString(), c)}`,
      `\u7EDF\u8BA1\u7ED3\u675F\uFF1A${localTime(end.toISOString(), c)}\uFF08\u4E0D\u542B\u7EC8\u70B9\uFF09`,
      "",
      ...flags.ping ? [`\u603B\u4F53\u5E73\u5747\u5EF6\u8FDF\uFF1A${totals.total ? latencyText(totals.averageLatency) : "\u65E0\u6570\u636E"}`] : [],
      ...flags.loss ? [`\u603B\u4F53\u5E73\u5747\u4E22\u5305\u7387\uFF1A${lossText(totals.averageLoss)}${totals.approximate ? "\uFF08\u542B\u4F30\u7B97\uFF09" : ""}`] : [],
      `\u5B9E\u9645\u63A2\u6D4B\u603B\u6570\uFF1A${totals.total}`,
      "",
      lines.join("\n\n"),
      "",
      flags.loss ? "\u6CE8\uFF1A\u4EC5\u7EDF\u8BA1\u73B0\u5B58\u63A2\u6D4B\u8BB0\u5F55\uFF0C\u7F3A\u62A5\u4E0D\u8BA1\u5165\u4E22\u5305\u3002" : "\u6CE8\uFF1A\u4EC5\u7EDF\u8BA1\u73B0\u5B58\u63A2\u6D4B\u8BB0\u5F55\u3002"
    ].join("\n");
    const template = plainText(str(c.report_template));
    const values = {
      event,
      event_code: code,
      message,
      start: localTime(start.toISOString(), c),
      end: localTime(end.toISOString(), c),
      latency: flags.ping ? totals.total ? latencyText(totals.averageLatency) : "\u65E0\u6570\u636E" : "",
      loss: flags.loss ? lossText(totals.averageLoss) : "",
      nodes: lines.join("\n\n"),
      count: String(totals.total)
    };
    return {
      event,
      code,
      emoji: "\u{1F4CA}",
      time: (/* @__PURE__ */ new Date()).toISOString(),
      metrics: metricKey(c),
      message: template ? template.replace(/\{\{(\w+)\}\}/g, (m, k) => values[k] ?? m) : message
    };
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
    if (!bool(c[`${kind}_enabled`], false) || !metricKey(c)) return;
    const { start, end } = reportRange(kind, /* @__PURE__ */ new Date(), number(c.custom_hours, 6, 0.05, 8760));
    const startText = start.toISOString(), endText = end.toISOString();
    if (state.reports[kind] === `${startText}/${endText}` || state.requests.some((r) => r.kind === kind && r.start === startText && r.end === endText)) return;
    if (state.requests.length >= 100) throw new Error("Report request queue full; check metrics API");
    state.requests.push({ kind, start: startText, end: endText, next: 0, attempts: 0 });
    save();
    await drainReports();
  }
  var lastTestSent = 0;
  var testSending = false;
  function header(req, name) {
    const key = Object.keys(req.headers).find((k) => k.toLowerCase() === name);
    const v = key ? req.headers[key] : "";
    return Array.isArray(v) ? v[0] : v || "";
  }
  function reply(res, status, data) {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify(data));
  }
  function isAdmin(req) {
    return req.context?.principal?.roles?.includes("admin") === true;
  }
  async function simulation(c, input) {
    const type = str(input.type, "ping-failure");
    const allowed = ["ping-failure", "ping-recovery", "loss-failure", "loss-recovery", "report"];
    if (!allowed.includes(type)) throw new Error("\u8BF7\u9009\u62E9\u6709\u6548\u7684\u6A21\u62DF\u7C7B\u578B");
    if (type.startsWith("ping") && !bool(c.enabled, true)) throw new Error("\u8BF7\u5148\u5F00\u542F\u63A2\u6D4B\u68C0\u6D4B\uFF0C\u518D\u6A21\u62DF\u63A2\u6D4B\u901A\u77E5");
    if (type.startsWith("loss") && !bool(c.loss_enabled, false)) throw new Error("\u8BF7\u5148\u5F00\u542F\u4E22\u5305\u7387\u68C0\u6D4B\uFF0C\u518D\u6A21\u62DF\u4E22\u5305\u901A\u77E5");
    const templates = input.templates && typeof input.templates === "object" ? input.templates : {};
    const config = { ...c };
    for (const k of ["failure_template", "recovery_template", "report_template"]) {
      if (typeof templates[k] === "string") {
        if (templates[k].length > 8e3) throw new Error("\u6A21\u677F\u8FC7\u957F\uFF0C\u6700\u591A 8000 \u5B57\u7B26");
        config[k] = templates[k];
      }
    }
    const selected = await scope(c), task = selected.tasks[0] || { id: 0, name: "\u6A21\u62DF\u4EFB\u52A1", target: "example.com", clients: ["simulation"] };
    const uuid = task.clients?.[0] || "simulation", nodes = selected.nodes;
    const now = /* @__PURE__ */ new Date(), r = rules(c);
    let event;
    if (type === "report") {
      const payload = reportEvent(
        config,
        "custom",
        new Date(now.getTime() - 36e5),
        now,
        [task],
        { ...nodes, [uuid]: nodes[uuid] || { name: "\u6A21\u62DF\u8282\u70B9" } },
        [{ entity_id: uuid, task_id: String(task.id), total: 100, valid: 100 - number(input.loss, 5, 0, 100), avg: number(input.latency, 45, 0, 6e5), loss: number(input.loss, 5, 0, 100) }]
      );
      if (!payload) throw new Error("\u63A2\u6D4B\u68C0\u6D4B\u548C\u4E22\u5305\u7387\u68C0\u6D4B\u5747\u672A\u5F00\u542F\uFF0C\u4E0D\u751F\u6210\u62A5\u544A");
      event = payload;
    } else event = alertEvent({
      rule: type.startsWith("loss") ? "loss" : "ping",
      recovered: type.endsWith("recovery"),
      time: now.toISOString(),
      count: type.startsWith("loss") ? type.endsWith("recovery") ? r.lossRecoveryCount : r.lossFailureCount : type.endsWith("recovery") ? r.recoveryCount : r.failureCount,
      latency: number(input.latency, type.endsWith("recovery") ? 50 : 250, -1, 6e5),
      lossPercent: number(input.loss, type.endsWith("recovery") ? 0 : 25, 0, 100)
    }, task, uuid, { ...nodes, [uuid]: nodes[uuid] || { name: "\u6A21\u62DF\u8282\u70B9" } }, config);
    const originalTitle = event.event;
    event.event = `\u3010\u6A21\u62DF\u3011${originalTitle}`;
    event.message = `\u3010\u6A21\u62DF\u901A\u77E5\uFF0C\u4E0D\u4EE3\u8868\u771F\u5B9E\u6545\u969C\u3011
${event.message.startsWith(originalTitle + "\n") ? event.message.slice(originalTitle.length + 1) : event.message}`;
    if (!selected.nodes[uuid]) event.clients = void 0;
    return event;
  }
  function registerTestRoutes() {
    import_plugin_sdk.server.route("GET", "/api/plugins/ping-alert/test/context", async (req, res) => {
      if (!isAdmin(req)) {
        reply(res, 403, { error: "\u4EC5\u7BA1\u7406\u5458\u53EF\u8BBF\u95EE" });
        return;
      }
      const c = await import_plugin_sdk.server.getConfig();
      reply(res, 200, {
        ping: bool(c.enabled, true),
        loss: bool(c.loss_enabled, false),
        templates: { failure_template: str(c.failure_template), recovery_template: str(c.recovery_template), report_template: str(c.report_template) }
      });
    });
    for (const action of ["preview", "send"]) import_plugin_sdk.server.route("POST", `/api/plugins/ping-alert/test/${action}`, async (req, res) => {
      if (!isAdmin(req)) {
        reply(res, 403, { error: "\u4EC5\u7BA1\u7406\u5458\u53EF\u8BBF\u95EE" });
        return;
      }
      if (header(req, "x-ping-alert-test") !== "1" || !header(req, "content-type").toLowerCase().startsWith("application/json")) {
        reply(res, 403, { error: "\u8BF7\u6C42\u6765\u6E90\u6821\u9A8C\u5931\u8D25" });
        return;
      }
      const origin = header(req, "origin");
      if (origin && header(req, "sec-fetch-site") !== "same-origin") {
        reply(res, 403, { error: "\u4E0D\u5141\u8BB8\u8DE8\u7AD9\u6D4B\u8BD5\u8BF7\u6C42" });
        return;
      }
      if (req.body.length > 32768) {
        reply(res, 413, { error: "\u8BF7\u6C42\u5185\u5BB9\u8FC7\u957F" });
        return;
      }
      let ownsLock = false;
      try {
        const c = await import_plugin_sdk.server.getConfig(), payload = await simulation(c, JSON.parse(req.body)), prepared = await deliveryPreview(payload);
        if (action === "send") {
          if (testSending || Date.now() - lastTestSent < 1e4) {
            reply(res, 429, { error: "\u8BF7\u95F4\u9694\u81F3\u5C11 10 \u79D2\u518D\u53D1\u9001\u6A21\u62DF\u901A\u77E5" });
            return;
          }
          if (!prepared.ready) {
            reply(res, 400, { error: "\u8BF7\u5148\u5F00\u542F Komari \u901A\u77E5\u5E76\u9009\u62E9\u901A\u77E5\u6E20\u9053" });
            return;
          }
          testSending = true;
          ownsLock = true;
          await import_plugin_sdk.server.call("admin:sendNotification", { event: prepared.payload });
          lastTestSent = Date.now();
        }
        reply(res, 200, {
          preview: prepared.preview,
          raw: prepared.raw,
          channel: prepared.channel,
          ready: prepared.ready,
          sent: action === "send",
          note: "\u9884\u89C8\u5305\u542B\u7CFB\u7EDF\u5168\u5C40\u6A21\u677F\u4E0E Telegram \u6807\u9898\uFF1B\u6700\u7EC8\u5BA2\u6237\u7AEF\u5B57\u4F53\u53CA\u81EA\u52A8\u94FE\u63A5\u7531\u901A\u77E5\u6E20\u9053\u51B3\u5B9A\u3002\u6D4B\u8BD5\u5931\u8D25\u4E0D\u4F1A\u81EA\u52A8\u91CD\u8BD5\u3002"
        });
      } catch (e) {
        reply(res, 400, { error: String(e instanceof Error ? e.message : e) });
      } finally {
        if (ownsLock) testSending = false;
      }
    });
  }
  (0, import_plugin_sdk.definePlugin)({
    async load() {
      sessionStart = (/* @__PURE__ */ new Date()).toISOString();
      state = readState();
      for (const [key, old] of Object.entries(state.entries)) state.entries[key] = freshMonitor(sessionStart, old);
      save();
      registerTestRoutes();
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
