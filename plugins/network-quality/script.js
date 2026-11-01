"use strict";
(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
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
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

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

  // src/schedules.ts
  var bounds = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 7]];
  function fieldValues(expression, index) {
    const [minimum, maximum] = bounds[index], result = /* @__PURE__ */ new Set();
    for (const part of expression.split(",")) {
      const match = /^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/.exec(part);
      if (!match) throw new Error("Cron \u4EC5\u652F\u6301\u6570\u5B57\u3001\u661F\u53F7\u3001\u8303\u56F4\u3001\u5217\u8868\u548C\u6B65\u957F");
      const step = match[2] ? Number(match[2]) : 1;
      if (step < 1 || step > maximum + 1) throw new Error("Cron \u6B65\u957F\u8D85\u51FA\u8303\u56F4");
      let low, high;
      if (match[1] === "*") {
        low = minimum;
        high = maximum;
      } else if (match[1].includes("-")) [low, high] = match[1].split("-").map(Number);
      else {
        low = Number(match[1]);
        high = match[2] ? maximum : low;
      }
      if (low < minimum || high > maximum || low > high) throw new Error("Cron \u6570\u5B57\u8D85\u51FA\u8303\u56F4");
      for (let value = low; value <= high; value += step) result.add(index === 4 && value === 7 ? 0 : value);
    }
    return result;
  }
  function validateCron(expression) {
    const fields = expression.trim().split(/\s+/);
    if (fields.length !== 5 || expression.length > 150) throw new Error("Cron \u5FC5\u987B\u662F\u4E94\u6BB5\u8868\u8FBE\u5F0F\uFF08\u5206 \u65F6 \u65E5 \u6708 \u5468\uFF09");
    fields.forEach(fieldValues);
    return fields.join(" ");
  }
  function scheduleCron(schedule) {
    if (schedule.kind === "custom") return validateCron(schedule.cron);
    const [hour, minute] = schedule.time.split(":").map(Number);
    return `${minute} ${hour} * * ${schedule.kind === "weekly" ? schedule.weekday : "*"}`;
  }
  function cronMatches(expression, time) {
    const fields = validateCron(expression).split(" "), values = fields.map(fieldValues);
    const local = new Date(time + 8 * 36e5);
    const parts = [local.getUTCMinutes(), local.getUTCHours(), local.getUTCDate(), local.getUTCMonth() + 1, local.getUTCDay()];
    if (![0, 1, 3].every((index) => values[index].has(parts[index]))) return false;
    const day = values[2].has(parts[2]), weekday = values[4].has(parts[4]);
    return fields[2] !== "*" && fields[4] !== "*" ? day || weekday : day && weekday;
  }

  // src/config.ts
  var PROVINCES = [
    ["bj", "\u5317\u4EAC"],
    ["tj", "\u5929\u6D25"],
    ["he", "\u6CB3\u5317"],
    ["sx", "\u5C71\u897F"],
    ["nm", "\u5185\u8499\u53E4"],
    ["ln", "\u8FBD\u5B81"],
    ["jl", "\u5409\u6797"],
    ["hl", "\u9ED1\u9F99\u6C5F"],
    ["sh", "\u4E0A\u6D77"],
    ["js", "\u6C5F\u82CF"],
    ["zj", "\u6D59\u6C5F"],
    ["ah", "\u5B89\u5FBD"],
    ["fj", "\u798F\u5EFA"],
    ["jx", "\u6C5F\u897F"],
    ["sd", "\u5C71\u4E1C"],
    ["ha", "\u6CB3\u5357"],
    ["hb", "\u6E56\u5317"],
    ["hn", "\u6E56\u5357"],
    ["gd", "\u5E7F\u4E1C"],
    ["gx", "\u5E7F\u897F"],
    ["hi", "\u6D77\u5357"],
    ["cq", "\u91CD\u5E86"],
    ["sc", "\u56DB\u5DDD"],
    ["gz", "\u8D35\u5DDE"],
    ["yn", "\u4E91\u5357"],
    ["xz", "\u897F\u85CF"],
    ["sn", "\u9655\u897F"],
    ["gs", "\u7518\u8083"],
    ["qh", "\u9752\u6D77"],
    ["nx", "\u5B81\u590F"],
    ["xj", "\u65B0\u7586"]
  ].map(([code, name]) => ({ code, name }));
  function defaultOptions() {
    return { modules: ["routes", "unlocks"], ipv: "4", provinces: PROVINCES.map((p) => p.code), count: 30, parallel: 4, timeoutMinutes: 30 };
  }
  function defaultConfig() {
    return { enabled: true, publicEnabled: true, defaults: defaultOptions(), retentionDays: 90, maxReportsPerNode: 100, schedules: {} };
  }
  function object(value, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label}\u683C\u5F0F\u4E0D\u6B63\u786E`);
    return value;
  }
  function keys(value, allowed) {
    if (Object.keys(value).some((key) => !allowed.includes(key))) throw new Error("\u914D\u7F6E\u542B\u6709\u4E0D\u652F\u6301\u7684\u5B57\u6BB5");
  }
  function bool(value, label) {
    if (typeof value !== "boolean") throw new Error(`${label}\u5FC5\u987B\u662F\u5F00\u5173`);
    return value;
  }
  function integer(value, minimum, maximum, label) {
    if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > maximum) throw new Error(`${label}\u8303\u56F4\u4E3A ${minimum}\u2013${maximum}`);
    return value;
  }
  function validateOptions(input, base = defaultOptions()) {
    const source = object(input, "\u68C0\u6D4B\u53C2\u6570");
    keys(source, ["modules", "ipv", "provinces", "count", "parallel", "timeoutMinutes"]);
    const merged = { ...base, ...source };
    if (!Array.isArray(merged.modules) || !merged.modules.length || merged.modules.some((value) => value !== "routes" && value !== "unlocks")) throw new Error("\u81F3\u5C11\u9009\u62E9\u4E00\u79CD\u6709\u6548\u7684\u68C0\u6D4B\u6A21\u5757");
    if (typeof merged.ipv !== "string" || !["4", "6", "both"].includes(merged.ipv)) throw new Error("\u8BF7\u9009\u62E9 IPv4\u3001IPv6 \u6216\u53CC\u6808");
    if (!Array.isArray(merged.provinces) || !merged.provinces.length || merged.provinces.some((value) => typeof value !== "string" || !PROVINCES.some((p) => p.code === value))) throw new Error("\u8BF7\u9009\u62E9\u6709\u6548\u7684\u68C0\u6D4B\u7701\u4EFD");
    return { modules: [...new Set(merged.modules)], ipv: merged.ipv, provinces: [...new Set(merged.provinces)], count: integer(merged.count, 1, 600, "\u63A2\u6D4B\u6B21\u6570"), parallel: integer(merged.parallel, 1, 31, "\u63A2\u6D4B\u5E76\u53D1"), timeoutMinutes: integer(merged.timeoutMinutes, 1, 30, "\u4EFB\u52A1\u8D85\u65F6\u5206\u949F") };
  }
  function validateConfig(input) {
    const source = object(input, "\u63D2\u4EF6\u914D\u7F6E");
    keys(source, ["enabled", "publicEnabled", "defaults", "retentionDays", "maxReportsPerNode", "schedules"]);
    const defaults = validateOptions(source.defaults), scheduleSource = object(source.schedules, "\u5B9A\u65F6\u914D\u7F6E"), schedules = {};
    if (Object.keys(scheduleSource).length > 500) throw new Error("\u5B9A\u65F6\u8282\u70B9\u8FC7\u591A");
    for (const [uuid, value] of Object.entries(scheduleSource)) {
      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(uuid) || ["__proto__", "prototype", "constructor"].includes(uuid)) throw new Error("\u8282\u70B9\u6807\u8BC6\u4E0D\u6B63\u786E");
      const entry = object(value, "\u8282\u70B9\u5B9A\u65F6");
      keys(entry, ["enabled", "kind", "time", "weekday", "cron", "options"]);
      if (!["daily", "weekly", "custom"].includes(String(entry.kind))) throw new Error("\u8BF7\u9009\u62E9\u6BCF\u65E5\u3001\u6BCF\u5468\u6216\u81EA\u5B9A\u4E49\u5B9A\u65F6");
      if (typeof entry.time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(entry.time)) throw new Error("\u65F6\u95F4\u5E94\u4E3A HH:mm");
      if (typeof entry.cron !== "string") throw new Error("Cron \u683C\u5F0F\u4E0D\u6B63\u786E");
      schedules[uuid] = { enabled: bool(entry.enabled, "\u8282\u70B9\u5B9A\u65F6"), kind: entry.kind, time: entry.time, weekday: integer(entry.weekday, 0, 6, "\u661F\u671F"), cron: validateCron(entry.cron), ...entry.options === void 0 ? {} : { options: validateOptions(entry.options, defaults) } };
    }
    return { enabled: bool(source.enabled, "\u542F\u7528\u68C0\u6D4B"), publicEnabled: bool(source.publicEnabled, "\u516C\u5F00\u5C55\u793A"), defaults, retentionDays: integer(source.retentionDays, 1, 3650, "\u4FDD\u7559\u5929\u6570"), maxReportsPerNode: integer(source.maxReportsPerNode, 1, 1e3, "\u6BCF\u8282\u70B9\u62A5\u544A\u6570\u91CF"), schedules };
  }

  // src/runner.ts
  var ENGINE_SOURCES = {
    tcp: {
      commit: "708ba0b073a63b10fa8894fb09174e12d01aa665",
      url: "https://raw.githubusercontent.com/ibsgss/TcpQuality/708ba0b073a63b10fa8894fb09174e12d01aa665/runTcpQuality-core.sh",
      sha256: "e815052b04eb36d332c671d34cb86121ae596a2e8b8375ab6fa150f502e4f712"
    },
    ip: {
      commit: "87397e2c3196ec796f5477c83343c2354df601ea",
      url: "https://raw.githubusercontent.com/xykt/IPQuality/87397e2c3196ec796f5477c83343c2354df601ea/ip.sh",
      sha256: "b30df5a3c2204276c54e99dcc5080b46f8a627667730aee7de63b109b8ecaecf"
    },
    nexttrace: {
      release: "v1.7.5",
      amd64: { url: "https://github.com/nxtrace/NTrace-core/releases/download/v1.7.5/nexttrace-tiny_linux_amd64", sha256: "4c25ab6f4000f1473ab928362e406ba0288cbdc034857eeedd83bb0e4d3ce653" },
      arm64: { url: "https://github.com/nxtrace/NTrace-core/releases/download/v1.7.5/nexttrace-tiny_linux_arm64", sha256: "e49e5d5cf6fa45ec4b7ac739eba674412b1e044d7502d56878c67ec8cde6c1d4" }
    }
  };
  var PROVINCE_CODES = ["bj", "tj", "he", "sx", "nm", "ln", "jl", "hl", "sh", "js", "zj", "ah", "fj", "jx", "sd", "ha", "hb", "hn", "gd", "gx", "hi", "cq", "sc", "gz", "yn", "xz", "sn", "gs", "qh", "nx", "xj"];
  var IP_MEDIA_FILTER = String.raw`/^check_IP\(\)\{/ { inside=1; anchors++ }
inside && ($0 == "countRunTimes" || $0 ~ /^db_/ || $0 ~ /&&db_/ || $0 == "check_mail" || $0 ~ /&&check_dnsbl /) { removed++; next }
/^show_ad$/ { ads++; next }
inside && /^(MediaUnlockTest_|OpenAITest )/ { media++ }
{ print }
inside && /^}$/ { inside=0 }
END { if (anchors != 1 || removed != 13 || ads != 1 || media != 7) exit 42 }`;
  function integer2(value, min, max, label) {
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${label} must be ${min}..${max}`);
    return value;
  }
  function buildCommand(jobId, options, mode = "detect") {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(jobId)) throw new Error("Invalid job id");
    if (!["detect", "preflight", "prepare"].includes(mode)) throw new Error("Invalid mode");
    if (!options.modules.length || options.modules.some((x) => x !== "routes" && x !== "unlocks")) throw new Error("Invalid modules");
    if (!["4", "6", "both"].includes(options.ipv)) throw new Error("Invalid IP family");
    if (options.provinces.some((x) => !PROVINCE_CODES.includes(x))) throw new Error("Invalid province");
    const count = integer2(options.count, 1, 600, "count");
    const parallel = integer2(options.parallel, 1, 31, "parallel");
    const seconds = integer2(options.timeoutMinutes, 1, 30, "timeoutMinutes") * 60;
    const routes = options.modules.includes("routes");
    const unlocks = options.modules.includes("unlocks");
    const families = options.ipv === "both" ? "4 6" : options.ipv;
    const provinces = [...new Set(options.provinces)].map((x) => `--province ${x}`).join(" ");
    const routeFlags = options.ipv === "both" ? "" : `-v${options.ipv}`;
    const engines = JSON.stringify({ ...routes ? { TcpQuality: ENGINE_SOURCES.tcp.commit, NextTrace: ENGINE_SOURCES.nexttrace.release } : {}, ...unlocks ? { IPQuality: ENGINE_SOURCES.ip.commit } : {} });
    return `sh -s <<'KOMARI_NQ_OUTER'
umask 077
MODE=${mode}
JOB=${jobId}
LOCK=/tmp/komari-network-quality.lock
TMP=
OWN_LOCK=0
WORKER=
WATCHDOG=
ERR=
MISSING=
PRE_ERRORS=
PRE_OK=true
RAW_CAP=0
add_error() { ERR="$ERR\\"$1\\","; }
add_pre_error() { PRE_ERRORS="$PRE_ERRORS\\"$1\\","; PRE_OK=false; }
cleanup() {
  trap '' HUP INT TERM
  if [ -n "$WORKER" ]; then
    kill -TERM "-$WORKER" 2>/dev/null || true
    sleep 1
    kill -KILL "-$WORKER" 2>/dev/null || true
    wait "$WORKER" 2>/dev/null || true
  fi
  if [ -n "$WATCHDOG" ]; then kill -TERM "-$WATCHDOG" 2>/dev/null || true; fi
  [ -z "$TMP" ] || rm -rf -- "$TMP"
  if [ "$OWN_LOCK" = 1 ]; then rm -f "$LOCK/pid"; rmdir "$LOCK" 2>/dev/null || true; fi
}
emit() {
  routes_raw=
  ip4_raw=
  ip6_raw=
  if [ -n "$TMP" ]; then
    for log in "$TMP/prepare.log" "$TMP/routes.log" "$TMP/ip4.log" "$TMP/ip6.log"; do
      if [ -s "$log" ]; then printf '\\nNQ_LOG:%s\\n' "\${log##*/}"; head -c 65536 "$log"; printf '\\n'; fi
    done
    [ ! -s "$TMP/routes.csv" ] || routes_raw=$(base64 < "$TMP/routes.csv" | tr -d '\\r\\n')
    [ ! -s "$TMP/ip4.json" ] || ip4_raw=$(base64 < "$TMP/ip4.json" | tr -d '\\r\\n')
    [ ! -s "$TMP/ip6.json" ] || ip6_raw=$(base64 < "$TMP/ip6.json" | tr -d '\\r\\n')
    if [ -s "$TMP/errors" ]; then ERR="$ERR$(cat "$TMP/errors")"; fi
  fi
  payload=$(printf '{"version":1,"mode":"%s","engines":${engines},"preflight":{"ok":%s,"errors":[%s],"missing":[%s],"details":{"jobId":"%s","rawSocketCapability":"%s","engine":"native-pinned","uploads":"disabled"}},"routes":[],"unlocks":[],"errors":[%s],"raw":{"routesCsvBase64":"%s","unlockJsonBase64":{"4":"%s","6":"%s"}}}' "$MODE" "$PRE_OK" "\${PRE_ERRORS%,}" "\${MISSING%,}" "$JOB" "$RAW_CAP" "\${ERR%,}" "$routes_raw" "$ip4_raw" "$ip6_raw")
  printf '\\nNQ_RESULT:'
  printf '%s' "$payload" | base64 | tr -d '\\r\\n'
  printf '\\n'
}
bounded() {
  rm -f "$TMP/timedout"
  setsid "$@" &
  WORKER=$!
  setsid sh -c 'sleep "$1"; : > "$3/timedout"; kill -TERM "-$2" 2>/dev/null || true; sleep 5; kill -KILL "-$2" 2>/dev/null || true' sh ${seconds} "$WORKER" "$TMP" &
  WATCHDOG=$!
  run_rc=0
  wait "$WORKER" || run_rc=$?
  if [ -f "$TMP/timedout" ]; then add_error RUN_TIMEOUT; run_rc=124; fi
  # Also reap detached children if the script leader exited before them.
  kill -KILL "-$WORKER" 2>/dev/null || true
  kill -TERM "-$WATCHDOG" 2>/dev/null || true
  wait "$WATCHDOG" 2>/dev/null || true
  WATCHDOG=
  WORKER=
  return "$run_rc"
}
interrupted() { add_error RUN_INTERRUPTED; emit; cleanup; exit 1; }
trap cleanup EXIT
trap interrupted HUP INT TERM
if ! command -v base64 >/dev/null 2>&1; then printf 'NQ_ERROR:BASE64_MISSING\\n'; exit 1; fi
if ! mkdir "$LOCK" 2>/dev/null; then
  # Recover only an empty, non-symlink lock whose recorded process is gone.
  if [ ! -L "$LOCK" ] && [ -d "$LOCK" ] && [ -r "$LOCK/pid" ]; then
    stale_pid=$(cat "$LOCK/pid")
    case "$stale_pid" in ''|*[!0-9]*) ;; *)
      if ! kill -0 "$stale_pid" 2>/dev/null; then rm -f "$LOCK/pid"; rmdir "$LOCK" 2>/dev/null || true; fi;;
    esac
  fi
  if ! mkdir "$LOCK" 2>/dev/null; then add_pre_error NODE_BUSY; emit; exit 0; fi
fi
OWN_LOCK=1
printf '%s\\n' "$$" > "$LOCK/pid"
TMP=$(mktemp -d /tmp/komari-nq.XXXXXXXX) || { add_pre_error TEMP_DIRECTORY_FAILED; emit; exit 0; }
export TMPDIR="$TMP"
if [ "$(uname -s)" != Linux ]; then add_pre_error LINUX_REQUIRED; fi
if [ -r /etc/NIXOS ]; then add_pre_error NIXOS_MANUAL_DEPENDENCIES_REQUIRED; fi
${routes ? 'if [ "$(id -u)" != 0 ]; then add_pre_error ROUTES_REQUIRE_ROOT; fi' : ""}
${routes && options.ipv !== "6" ? 'case "$(uname -m)" in x86_64|aarch64|arm64) ;; *) add_pre_error LARGE_PROBE_REQUIRES_AMD64_OR_ARM64;; esac' : ""}
if [ -r /proc/self/status ]; then
  cap=$(awk '/^CapEff:/{print $2}' /proc/self/status)
  cap_tail=$(printf '%s' "$cap" | sed 's/.*\\(....\\)$/\\1/')
  case "$cap_tail" in ''|*[!0-9a-fA-F]*) ;; *) RAW_CAP=$(( (0x$cap_tail & 8192) / 8192 ));; esac
fi
${routes ? 'if [ "$RAW_CAP" != 1 ]; then add_pre_error CAP_NET_RAW_REQUIRED; fi' : ""}
free_kb=$(df -Pk "$TMP" 2>/dev/null | awk 'END{print $4}')
case "$free_kb" in ''|*[!0-9]*) add_pre_error DISK_SPACE_UNKNOWN;; *) [ "$free_kb" -ge 32768 ] || add_pre_error DISK_SPACE_BELOW_32MB;; esac
if [ "$MODE" = prepare ]; then
  if [ "$(id -u)" != 0 ]; then add_pre_error PREPARE_REQUIRES_ROOT
  elif ! command -v setsid >/dev/null 2>&1; then add_pre_error PREPARE_REQUIRES_SETSID
  elif command -v apt-get >/dev/null 2>&1; then
    if ! bounded sh -c 'export DEBIAN_FRONTEND=noninteractive; apt-get update && apt-get install -y --no-install-recommends bash curl ca-certificates jq coreutils util-linux procps ${routes ? "nmap traceroute iproute2" : ""} ${unlocks ? "bc netcat-openbsd dnsutils iproute2" : ""}' > "$TMP/prepare.log" 2>&1; then add_pre_error DEPENDENCY_INSTALL_FAILED; fi
  elif command -v apk >/dev/null 2>&1; then
    if ! bounded apk add --no-cache bash curl ca-certificates jq coreutils util-linux procps ${routes ? "nmap-nping traceroute iproute2" : ""} ${unlocks ? "bc netcat-openbsd bind-tools grep iproute2" : ""} > "$TMP/prepare.log" 2>&1; then add_pre_error DEPENDENCY_INSTALL_FAILED; fi
  else add_pre_error PREPARE_SUPPORTS_APT_OR_APK_ONLY
  fi
fi
for tool in bash curl jq sha256sum setsid awk sed grep cut sort find mktemp df date tr base64 head wc ${routes ? "nping traceroute ip" : ""} ${unlocks ? "bc nc dig ip" : ""}; do
  if ! command -v "$tool" >/dev/null 2>&1; then MISSING="$MISSING\\"$tool\\","; PRE_OK=false; fi
done
if [ -n "$MISSING" ]; then add_pre_error DEPENDENCIES_MISSING; fi
if command -v bash >/dev/null 2>&1; then
  if ! bash -c 'test "\${BASH_VERSINFO[0]}" -ge 4'; then add_pre_error BASH_4_REQUIRED; fi
fi
if [ "$MODE" != detect ] || [ "$PRE_OK" != true ]; then emit; exit 0; fi
cat > "$TMP/worker.sh" <<'KOMARI_NQ_WORKER'
set -u
cd "$TMPDIR" || exit 1
: > errors
fail() { printf '"%s",' "$1" >> errors; }
fetch_checked() {
  name=$1 url=$2 sum=$3
  if ! curl --proto '=https' --proto-redir '=https' --tlsv1.2 -fsSL --connect-timeout 15 --max-time 90 "$url" -o "$name"; then fail "DOWNLOAD_$name"; return 1; fi
  if ! printf '%s  %s\\n' "$sum" "$name" | sha256sum -c - >/dev/null 2>&1; then fail "CHECKSUM_$name"; rm -f "$name"; return 1; fi
}
${routes ? `if ! (
${options.ipv !== "6" ? `mkdir -p "$TMPDIR/bin"
case "$(uname -m)" in
  x86_64) trace_url='${ENGINE_SOURCES.nexttrace.amd64.url}'; trace_sha='${ENGINE_SOURCES.nexttrace.amd64.sha256}' ;;
  aarch64|arm64) trace_url='${ENGINE_SOURCES.nexttrace.arm64.url}'; trace_sha='${ENGINE_SOURCES.nexttrace.arm64.sha256}' ;;
esac
if ! fetch_checked bin/nexttrace-tiny "$trace_url" "$trace_sha"; then exit 1; fi
chmod 700 "$TMPDIR/bin/nexttrace-tiny"
PATH="$TMPDIR/bin:$PATH"
export PATH
` : ""}if fetch_checked tcp.sh '${ENGINE_SOURCES.tcp.url}' '${ENGINE_SOURCES.tcp.sha256}'; then
  # Isolate the upstream CSV path inside this run. No rootfs, upload, speedtest or intl flags.
  sed 's|/tmp/zstatic_nping_|\${TMPDIR:-/tmp}/zstatic_nping_|g' tcp.sh > tcp-native.sh
  if ! env -i PATH="$PATH" HOME="$TMPDIR" TMPDIR="$TMPDIR" TERM=dumb LC_ALL=C TCPQUALITY_NIX_BOOTSTRAPPED=1 bash ./tcp-native.sh --no-rank-upload -c ${count} -p ${parallel} ${routeFlags} ${provinces} > routes.log 2>&1; then fail ROUTES_EXECUTION_FAILED; fi
  for csv in "$TMPDIR"/zstatic_nping_*.csv; do
    if [ -f "$csv" ]; then
      bytes=$(wc -c < "$csv")
      if [ "$bytes" -le 1048576 ]; then cat "$csv" >> routes.csv; else fail ROUTES_OUTPUT_TOO_LARGE; fi
    fi
  done
  [ -s routes.csv ] || fail ROUTES_RESULT_MISSING
fi
); then fail ROUTES_MODULE_FAILED; fi` : ""}
${unlocks ? `if fetch_checked ip.sh '${ENGINE_SOURCES.ip.url}' '${ENGINE_SOURCES.ip.sha256}'; then
  cat > ip-media-filter.awk <<'KOMARI_NQ_MEDIA_FILTER'
${IP_MEDIA_FILTER}
KOMARI_NQ_MEDIA_FILTER
  if ! awk -f ip-media-filter.awk ip.sh > ip-media-base.sh; then fail UNLOCKS_ADAPTER_SOURCE_MISMATCH; exit 1; fi
  # Pin cookie/reference data too; never fetch mutable main-branch references.
  sed 's|main/ref/|${ENGINE_SOURCES.ip.commit}/ref/|g' ip-media-base.sh > ip-media.sh
  for family in ${families}; do
    # Separate family files handle IPQuality's JSON-stream output without guessing the family.
    if ! env -i PATH="$PATH" HOME="$TMPDIR" TMPDIR="$TMPDIR" TERM=dumb LC_ALL=C bash ./ip-media.sh -"$family" -n -p -j -o "$TMPDIR/ip$family.json" > "ip$family.log" 2>&1; then fail "UNLOCKS_IPV\${family}_EXECUTION_FAILED"; fi
    if [ -s "ip$family.json" ]; then
      bytes=$(wc -c < "ip$family.json")
      if [ "$bytes" -gt 1048576 ]; then rm -f "ip$family.json"; fail "UNLOCKS_IPV\${family}_OUTPUT_TOO_LARGE"; fi
    else fail "UNLOCKS_IPV\${family}_RESULT_MISSING"
    fi
  done
fi` : ""}
KOMARI_NQ_WORKER
if ! bounded sh "$TMP/worker.sh"; then add_error WORKER_EXITED; fi
emit
KOMARI_NQ_OUTER`;
  }

  // src/parsers.ts
  var MAX_PAYLOAD = 4 * 1024 * 1024;
  function object2(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
  }
  function strings(value) {
    return Array.isArray(value) ? value.filter((x) => typeof x === "string").slice(0, 200) : [];
  }
  function text(value) {
    if (typeof value !== "string") return null;
    const result = value.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "").trim();
    return !result || /^(?:null|undefined|N\/A|NA|—|--|-)$/i.test(result) ? null : result.slice(0, 1e3);
  }
  function decodeBase64Utf8(encoded) {
    if (encoded.length > MAX_PAYLOAD * 2 || encoded.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new Error("Invalid base64 result");
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const output = [];
    for (let i = 0; i < encoded.length; i += 4) {
      const a = alphabet.indexOf(encoded[i]);
      const b = alphabet.indexOf(encoded[i + 1]);
      const c = alphabet.indexOf(encoded[i + 2]);
      const d = alphabet.indexOf(encoded[i + 3]);
      if (a < 0 || b < 0) throw new Error("Invalid base64 padding");
      output.push(`%${(a << 2 | b >> 4).toString(16).padStart(2, "0")}`);
      if (encoded[i + 2] !== "=") output.push(`%${((b & 15) << 4 | c >> 2).toString(16).padStart(2, "0")}`);
      if (encoded[i + 3] !== "=") output.push(`%${((c & 3) << 6 | d).toString(16).padStart(2, "0")}`);
    }
    return decodeURIComponent(output.join(""));
  }
  function readCsv(csv) {
    if (csv.length > MAX_PAYLOAD) throw new Error("CSV result too large");
    const rows = [];
    let row = [], cell = "", quoted = false;
    const input = csv.replace(/^\uFEFF/, "");
    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      if (ch === '"') {
        if (quoted && input[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = !quoted;
      } else if (ch === "," && !quoted) {
        row.push(cell);
        cell = "";
      } else if ((ch === "\n" || ch === "\r") && !quoted) {
        if (ch === "\r" && input[i + 1] === "\n") i++;
        row.push(cell);
        if (row.some((x) => x.trim())) rows.push(row);
        row = [];
        cell = "";
      } else cell += ch;
    }
    if (quoted) throw new Error("Truncated CSV quoted value");
    if (cell || row.length) {
      row.push(cell);
      rows.push(row);
    }
    return rows;
  }
  function finite(value, min, max = Number.MAX_SAFE_INTEGER) {
    if (typeof value !== "number" && typeof value !== "string") return null;
    if (typeof value === "string" && !text(value)) return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= min && number <= max ? number : null;
  }
  function parseTcpQualityCsv(csv) {
    const rows = readCsv(csv);
    const headerIndex = rows.findIndex((row) => row.includes("\u8FD0\u8425\u5546") && row.includes("\u72B6\u6001"));
    if (headerIndex < 0) throw new Error("TcpQuality CSV header missing");
    const header2 = rows[headerIndex];
    const column = (row, name) => row[header2.indexOf(name)];
    const results = /* @__PURE__ */ new Map();
    for (const row of rows.slice(headerIndex + 1)) {
      const carrier = column(row, "\u8FD0\u8425\u5546");
      if (carrier !== "\u7535\u4FE1" && carrier !== "\u8054\u901A" && carrier !== "\u79FB\u52A8") continue;
      const network = column(row, "\u7F51\u7EDC");
      if (network !== "\u4E09\u7F51" && network !== "IPv4\u5927\u5305") continue;
      const familyText = column(row, "IP\u7248\u672C");
      if (familyText !== "IPv4" && familyText !== "IPv6") continue;
      const province = text(column(row, "\u7701\u4EFD"));
      if (!province) continue;
      const family = familyText === "IPv4" ? 4 : 6;
      const sourceStatus = column(row, "\u72B6\u6001")?.toUpperCase();
      const sent = finite(column(row, "\u53D1\u9001"), 0);
      const received = finite(column(row, "\u6536\u5230"), 0);
      const loss = finite(column(row, "\u4E22\u5305\u7387(%)"), 0, 100);
      const responded = received !== null && received > 0;
      const status = sourceStatus === "SKIP" ? "unsupported" : sourceStatus === "OK" && responded ? "ok" : sent !== null && sent > 0 && received === 0 ? "no-response" : "failed";
      const lineText = text(column(row, "\u7EBF\u8DEF"));
      const line = lineText && !/^(?:Hidden|failed|unknown)$/i.test(lineText) ? lineText : null;
      const key = `${province}:${carrier}:${family}`;
      const packetType = network === "IPv4\u5927\u5305" ? "large" : "standard";
      if (packetType === "standard" && results.get(key)?.packetType === "large") continue;
      results.set(key, Object.assign({
        province,
        carrier,
        family,
        line,
        latency: responded ? finite(column(row, "\u5E73\u5747\u5EF6\u8FDFms"), 0) : null,
        loss,
        sent,
        received,
        status
      }, { packetType }));
    }
    return [...results.values()];
  }
  function readJsonDocuments(source) {
    if (source.length > MAX_PAYLOAD) throw new Error("IPQuality result too large");
    const result = [];
    let start = -1, depth = 0, quoted = false, escaped = false;
    for (let i = 0; i < source.length; i++) {
      const char = source[i];
      if (start < 0) {
        if (/\s|\uFEFF/.test(char)) continue;
        if (char !== "{" && char !== "[") throw new Error("Unexpected text in JSON result");
        start = i;
        depth = 1;
        continue;
      }
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') quoted = false;
      } else if (char === '"') quoted = true;
      else if (char === "{" || char === "[") depth++;
      else if (char === "}" || char === "]") {
        depth--;
        if (depth === 0) {
          result.push(JSON.parse(source.slice(start, i + 1)));
          start = -1;
        }
      }
    }
    if (start !== -1) throw new Error("Truncated JSON result");
    return result;
  }
  function parseIpQualityJson(source, family) {
    const result = /* @__PURE__ */ new Map();
    const aliases = { DisneyPlus: "Disney+", Youtube: "YouTube", AmazonPrimeVideo: "PrimeVideo" };
    for (const doc of readJsonDocuments(source)) {
      const media = object2(object2(doc).Media);
      for (const [name, raw] of Object.entries(media)) {
        const data = object2(raw);
        const detailStatus = text(data.Status);
        const type = text(data.Type);
        const region = text(data.Region);
        let status = "unknown";
        if (detailStatus && /^(?:解锁|Yes|Available|Unlocked)$/i.test(detailStatus)) status = "available";
        else if (detailStatus && /^(?:待支持|Unsupported|Pending)$/i.test(detailStatus)) status = "unsupported";
        else if (detailStatus && /^(?:屏蔽|仅自制|仅网页|仅APP|机房|禁会员|中国|No|Blocked|Restricted|Originals?\s*Only|Org\.?|NoPrem\.?|Web\s*Only|App\s*Only|IDC|China)$/i.test(detailStatus)) status = "restricted";
        const service = aliases[name] ?? name;
        result.set(service, { service, family, status, region, detail: [detailStatus, type].filter(Boolean).join(" \xB7 ") || null });
      }
    }
    return [...result.values()];
  }
  function parseResult(output) {
    if (typeof output !== "string" || output.length > MAX_PAYLOAD * 3) throw new Error("Detection output missing or too large");
    const matches = [...output.matchAll(/(?:^|\r?\n)NQ_RESULT:([A-Za-z0-9+/=]+)(?=\r?\n|$)/g)];
    if (!matches.length) throw new Error("\u68C0\u6D4B\u672A\u8FD4\u56DE\u5B8C\u6574\u7ED3\u679C\u6807\u8BB0\uFF0C\u8BF7\u67E5\u770B\u7BA1\u7406\u5458\u6267\u884C\u65E5\u5FD7");
    const source = object2(JSON.parse(decodeBase64Utf8(matches[matches.length - 1][1])));
    if (source.version !== 1) throw new Error("Unsupported detection result version");
    const raw = object2(source.raw);
    const errors = strings(source.errors);
    let routes = [], unlocks = [];
    if (typeof raw.routesCsvBase64 === "string" && raw.routesCsvBase64) {
      try {
        routes = parseTcpQualityCsv(decodeBase64Utf8(raw.routesCsvBase64));
      } catch (error) {
        errors.push(`ROUTES_PARSE_FAILED: ${String(error)}`);
      }
    }
    const unlockSources = object2(raw.unlockJsonBase64);
    for (const family of [4, 6]) {
      const encoded = unlockSources[String(family)];
      if (typeof encoded === "string" && encoded) {
        try {
          unlocks.push(...parseIpQualityJson(decodeBase64Utf8(encoded), family));
        } catch (error) {
          errors.push(`UNLOCKS_IPV${family}_PARSE_FAILED: ${String(error)}`);
        }
      }
    }
    const pre = object2(source.preflight);
    const details = {};
    for (const [key, value] of Object.entries(object2(pre.details))) if (typeof value === "string") details[key] = value.slice(0, 500);
    const preflight = { ok: pre.ok === true, errors: strings(pre.errors), missing: strings(pre.missing), details };
    const engines = {};
    for (const [key, value] of Object.entries(object2(source.engines))) if (typeof value === "string") engines[key] = value.slice(0, 100);
    return { version: 1, mode: typeof source.mode === "string" ? source.mode : void 0, preflight, routes, unlocks, errors, engines };
  }

  // src/store.ts
  var StateStore = class {
    constructor(directory, fs = __require("fs")) {
      __publicField(this, "directory", directory);
      __publicField(this, "fs", fs);
      __publicField(this, "stateFile");
      this.stateFile = `${directory}/state-v1.json`;
    }
    load(now) {
      if (!this.fs.existsSync(this.stateFile)) return { version: 1, config: defaultConfig(), jobs: [], reports: [], lastScheduleMinute: Math.floor(now / 6e4) };
      const parsed = JSON.parse(this.fs.readFileSync(this.stateFile, "utf8"));
      if (parsed.version !== 1 || !Array.isArray(parsed.jobs) || !Array.isArray(parsed.reports)) throw new Error("\u68C0\u6D4B\u63D2\u4EF6\u72B6\u6001\u6587\u4EF6\u635F\u574F\uFF0C\u8BF7\u4ECE\u5907\u4EFD\u6062\u590D\uFF0C\u907F\u514D\u91CD\u590D\u6267\u884C");
      parsed.config = validateConfig(parsed.config);
      return parsed;
    }
    save(state) {
      this.write(this.stateFile, JSON.stringify(state));
    }
    write(path, value) {
      this.fs.mkdirSync(this.directory, { recursive: true });
      this.fs.writeFileSync(`${path}.tmp`, value, "utf8");
      this.fs.renameSync(`${path}.tmp`, path);
    }
    rawPath(id) {
      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new Error("\u62A5\u544A\u6807\u8BC6\u4E0D\u6B63\u786E");
      return `${this.directory}/raw-${id}.txt`;
    }
    saveRaw(id, raw) {
      this.write(this.rawPath(id), raw);
    }
    readRaw(id) {
      const path = this.rawPath(id);
      return this.fs.existsSync(path) ? this.fs.readFileSync(path, "utf8") : "\u539F\u59CB\u8F93\u51FA\u5DF2\u8FC7\u671F\u6216\u4E0D\u5B58\u5728";
    }
    removeRaw(id) {
      const path = this.rawPath(id);
      if (this.fs.existsSync(path)) this.fs.unlinkSync(path);
    }
    prune(state, now) {
      var _a;
      const keep = [], counts = {}, cutoff = now - state.config.retentionDays * 864e5;
      for (const report of [...state.reports].sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))) {
        counts[_a = report.uuid] ?? (counts[_a] = 0);
        if (Date.parse(report.completedAt) >= cutoff && counts[report.uuid] < state.config.maxReportsPerNode) {
          keep.push(report);
          counts[report.uuid]++;
        } else this.removeRaw(report.id);
      }
      state.reports = keep;
      const reportIds = new Set(keep.map((report) => report.id));
      const pending = state.jobs.filter((job) => !job.completedAt);
      const finished = state.jobs.filter((job) => job.completedAt && Date.parse(job.completedAt) >= cutoff && (reportIds.has(job.id) || job.mode !== "detect")).slice(-2e3);
      state.jobs = [...pending, ...finished];
    }
  };

  // src/plugin.ts
  var BASE = "/api/plugins/network-quality/v1";
  var active = (job) => !job.completedAt;
  var message = (error) => error instanceof Error ? error.message : String(error);
  var NetworkRuntime = class {
    constructor(host, store, now = Date.now) {
      __publicField(this, "host", host);
      __publicField(this, "store", store);
      __publicField(this, "now", now);
      __publicField(this, "state");
      __publicField(this, "chain", Promise.resolve());
      this.state = store.load(now());
      this.state.lastScheduleMinute = Math.floor(now() / 6e4);
      store.prune(this.state, now());
      store.save(this.state);
    }
    exclusive(fn) {
      const next = this.chain.then(fn);
      this.chain = next.catch(() => void 0);
      return next;
    }
    save() {
      this.store.save(this.state);
    }
    async effective() {
      const managed = await this.host.getConfig();
      return { enabled: managed.enabled !== false && this.state.config.enabled, publicEnabled: managed.public_enabled !== false && this.state.config.publicEnabled };
    }
    async nodes() {
      return this.host.call("common:getNodes");
    }
    async nodeList() {
      const nodes = await this.nodes();
      let status = {};
      try {
        status = await this.host.call("common:getNodesLatestStatus");
      } catch {
      }
      return Object.entries(nodes).map(([uuid, node]) => ({ uuid, name: node.name || uuid, hidden: node.hidden === true, online: status[uuid]?.online === true }));
    }
    async configure(input) {
      const config = validateConfig(input), nodes = await this.nodes();
      if (Object.keys(config.schedules).some((uuid) => !nodes[uuid])) throw new Error("\u5B9A\u65F6\u914D\u7F6E\u5305\u542B\u4E0D\u5B58\u5728\u7684\u8282\u70B9");
      this.state.config = config;
      this.state.lastScheduleMinute = Math.floor(this.now() / 6e4);
      this.store.prune(this.state, this.now());
      this.save();
      return config;
    }
    add(uuid, mode, options, source) {
      const id = `nq_${this.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
      const job = { id, uuid, mode, options, source, status: "queued", createdAt: new Date(this.now()).toISOString(), errors: [] };
      this.state.jobs.push(job);
      return job;
    }
    async enqueue(input) {
      if (!(await this.effective()).enabled) throw new Error("\u7F51\u7EDC\u68C0\u6D4B\u603B\u5F00\u5173\u5DF2\u5173\u95ED");
      const data = object(input, "\u68C0\u6D4B\u8BF7\u6C42");
      if (Object.keys(data).some((key) => !["uuids", "mode", "options"].includes(key))) throw new Error("\u68C0\u6D4B\u8BF7\u6C42\u542B\u6709\u4E0D\u652F\u6301\u7684\u5B57\u6BB5");
      if (!Array.isArray(data.uuids) || !data.uuids.length || data.uuids.length > 100 || data.uuids.some((uuid) => typeof uuid !== "string")) throw new Error("\u8BF7\u9009\u62E9 1\u2013100 \u4E2A\u8282\u70B9");
      const uuids = [...new Set(data.uuids)], mode = data.mode ?? "detect";
      if (!["detect", "preflight", "prepare"].includes(String(mode))) throw new Error("\u68C0\u6D4B\u64CD\u4F5C\u4E0D\u6B63\u786E");
      const options = validateOptions(data.options ?? {}, this.state.config.defaults), nodes = await this.nodes();
      for (const uuid of uuids) {
        if (!nodes[uuid]) throw new Error("\u6240\u9009\u8282\u70B9\u4E0D\u5B58\u5728");
        if (this.state.jobs.some((job) => job.uuid === uuid && active(job))) throw new Error(`\u8282\u70B9 ${nodes[uuid].name || uuid} \u5DF2\u6709\u6392\u961F\u6216\u8FD0\u884C\u4E2D\u7684\u4EFB\u52A1`);
      }
      const jobs = uuids.map((uuid) => this.add(uuid, mode, options, "manual"));
      this.save();
      return jobs;
    }
    finishFailure(job, error, status = "failed") {
      job.errors.push(error);
      job.status = status;
      job.completedAt = new Date(this.now()).toISOString();
      if (job.mode === "detect") this.state.reports.unshift({ id: job.id, uuid: job.uuid, startedAt: job.startedAt || job.createdAt, completedAt: job.completedAt, status: "failed", ipv: job.options.ipv, routes: [], unlocks: [], errors: [...job.errors], options: job.options, taskId: job.taskId, engines: job.engines });
      this.save();
    }
    finishResult(job, result) {
      let parsed;
      if (job.mode === "detect") this.store.saveRaw(job.id, result.result);
      try {
        parsed = parseResult(result.result);
      } catch (error) {
        this.finishFailure(job, `\u7ED3\u679C\u89E3\u6790\u5931\u8D25\uFF1A${message(error)}`);
        return;
      }
      job.preflight = parsed.preflight;
      const errors = [.../* @__PURE__ */ new Set([...parsed.errors || [], ...parsed.preflight?.ok === false ? parsed.preflight.errors : []])];
      const good = parsed.routes.some((route) => route.status === "ok" || route.status === "no-response") || parsed.unlocks.some((unlock) => unlock.status === "available" || unlock.status === "restricted");
      const usable = parsed.routes.length + parsed.unlocks.length > 0;
      const missingModule = job.mode === "detect" && (job.options.modules.includes("routes") && !parsed.routes.length || job.options.modules.includes("unlocks") && !parsed.unlocks.length);
      const degraded = errors.length > 0 || result.exit_code !== 0 || missingModule || parsed.routes.some((route) => route.status === "failed" || route.status === "unsupported") || parsed.unlocks.some((unlock) => unlock.status === "unknown" || unlock.status === "unsupported");
      job.status = job.mode === "detect" ? usable ? degraded ? "partial" : "succeeded" : "failed" : parsed.preflight?.ok === true && result.exit_code === 0 ? "succeeded" : "failed";
      if (job.mode === "detect" && usable && !good && degraded) job.status = "failed";
      if (missingModule) errors.push("\u90E8\u5206\u68C0\u6D4B\u6A21\u5757\u6CA1\u6709\u8FD4\u56DE\u6570\u636E");
      if (!usable && job.mode === "detect") errors.push("\u672A\u8FD4\u56DE\u53EF\u7528\u68C0\u6D4B\u7ED3\u679C");
      if (result.exit_code !== 0 && !errors.length) errors.push(`\u8FDC\u7A0B\u68C0\u6D4B\u9000\u51FA\u7801\uFF1A${result.exit_code}`);
      job.errors = [...new Set(errors)];
      job.completedAt = result.finished_at && Number.isFinite(Date.parse(result.finished_at)) ? result.finished_at : new Date(this.now()).toISOString();
      if (job.mode === "detect") this.state.reports.unshift({ id: job.id, uuid: job.uuid, startedAt: job.startedAt || job.createdAt, completedAt: job.completedAt, status: job.status, ipv: job.options.ipv, routes: parsed.routes, unlocks: parsed.unlocks, errors: job.errors, options: job.options, taskId: job.taskId, engines: job.engines });
      this.store.prune(this.state, this.now());
      this.save();
    }
    async collect(job) {
      const started = Date.parse(job.startedAt || job.createdAt);
      if (this.now() > started + job.options.timeoutMinutes * 6e4 + 12e4) {
        this.finishFailure(job, "\u68C0\u6D4B\u8D85\u65F6\uFF0C\u672A\u6536\u5230\u5B8C\u6574\u7ED3\u679C", "timed-out");
        return;
      }
      try {
        if (!job.taskId) {
          const tasks = await this.host.call("admin:getTasksByClientId", { uuid: job.uuid });
          const found = tasks.filter((task2) => task2.command?.startsWith(`# KOMARI_NETWORK_QUALITY_JOB:${job.id}
`));
          if (found.length === 1) {
            job.taskId = found[0].task_id;
            job.status = "running";
            this.save();
          } else {
            job.status = "uncertain";
            this.save();
            return;
          }
        }
        const task = await this.host.call("admin:getTaskById", { task_id: job.taskId });
        const result = task.results?.find((value) => value.client === job.uuid && value.finished_at && value.exit_code !== null);
        if (result) this.finishResult(job, result);
      } catch (error) {
        console.warn("network-quality: waiting for task %s: %s", job.id, message(error));
      }
    }
    async dispatch(job) {
      try {
        const nodes = await this.nodes(), node = nodes[job.uuid];
        if (!node) {
          this.finishFailure(job, "\u8282\u70B9\u5DF2\u5220\u9664\uFF0C\u672A\u4E0B\u53D1\u68C0\u6D4B");
          return;
        }
        const os = typeof node.os === "string" ? node.os.trim() : "";
        if (os && !/linux|ubuntu|debian|centos|alpine|fedora|rocky|alma|arch|opensuse|suse|rhel|red hat|openwrt|oracle|nixos|gentoo|amazon|raspbian/i.test(os)) {
          this.finishFailure(job, "\u5F53\u524D\u68C0\u6D4B\u811A\u672C\u4EC5\u652F\u6301 Linux \u8282\u70B9\uFF0C\u672A\u4E0B\u53D1\u68C0\u6D4B");
          return;
        }
        const latest = await this.host.call("common:getNodesLatestStatus");
        if (latest[job.uuid]?.online !== true) {
          this.finishFailure(job, "\u8282\u70B9\u5F53\u524D\u79BB\u7EBF\uFF0C\u672A\u4E0B\u53D1\u68C0\u6D4B");
          return;
        }
      } catch (error) {
        this.finishFailure(job, `\u8282\u70B9\u72B6\u6001\u68C0\u67E5\u5931\u8D25\uFF0C\u672A\u4E0B\u53D1\u68C0\u6D4B\uFF1A${message(error)}`);
        return;
      }
      job.status = "dispatching";
      job.startedAt = new Date(this.now()).toISOString();
      job.engines = { TcpQuality: ENGINE_SOURCES.tcp.commit, IPQuality: ENGINE_SOURCES.ip.commit };
      this.save();
      let command;
      try {
        command = `# KOMARI_NETWORK_QUALITY_JOB:${job.id}
${buildCommand(job.id, job.options, job.mode)}`;
      } catch (error) {
        this.finishFailure(job, message(error));
        return;
      }
      try {
        const task = await this.host.call("admin:exec", { command, clients: [job.uuid] });
        if (!task.task_id) throw new Error("Komari \u672A\u8FD4\u56DE\u8FDC\u7A0B\u4EFB\u52A1\u6807\u8BC6");
        job.taskId = task.task_id;
        job.status = "running";
        this.save();
      } catch (error) {
        job.status = "uncertain";
        job.errors = [`\u4E0B\u53D1\u7ED3\u679C\u5F85\u6838\u5B9E\uFF1A${message(error)}`];
        this.save();
      }
    }
    async tick() {
      const enabled = (await this.effective()).enabled;
      const running = this.state.jobs.find((job) => active(job) && job.status !== "queued");
      if (running) await this.collect(running);
      const minute = Math.floor(this.now() / 6e4);
      if (minute !== this.state.lastScheduleMinute) {
        this.state.lastScheduleMinute = minute;
        if (enabled) {
          const nodes = await this.nodes();
          for (const [uuid, schedule] of Object.entries(this.state.config.schedules)) {
            if (schedule.enabled && nodes[uuid] && cronMatches(scheduleCron(schedule), this.now()) && !this.state.jobs.some((job) => job.uuid === uuid && (active(job) || job.source === "schedule" && Math.floor(Date.parse(job.createdAt) / 6e4) === minute))) this.add(uuid, "detect", validateOptions(schedule.options || {}, this.state.config.defaults), "schedule");
          }
        }
        this.store.prune(this.state, this.now());
        this.save();
      }
      if (enabled && !this.state.jobs.some((job) => active(job) && job.status !== "queued")) {
        const queued = this.state.jobs.find((job) => active(job) && job.status === "queued");
        if (queued) await this.dispatch(queued);
      }
    }
    history(uuid) {
      return this.state.reports.filter((report) => report.uuid === uuid);
    }
  };
  function header(req, name) {
    const found = Object.entries(req.headers).find(([key]) => key.toLowerCase() === name)?.[1];
    return Array.isArray(found) ? found[0] || "" : found || "";
  }
  function isAdmin(req) {
    return req.context?.principal?.roles?.includes("admin") === true;
  }
  function reply(res, status, data) {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(JSON.stringify(data));
  }
  function privateText(value) {
    return String(value).replace(/\[?(?:[a-fA-F0-9]{0,4}:){2,}[a-fA-F0-9:.]{0,39}(?:%[a-zA-Z0-9_.-]+)?\]?/g, "[IP\u5DF2\u9690\u85CF]").replace(/(?:\d{1,3}\.){3}\d{1,3}/g, "[IP\u5DF2\u9690\u85CF]").slice(0, 300);
  }
  function publicReport(report) {
    return {
      id: report.id,
      uuid: report.uuid,
      startedAt: report.startedAt,
      completedAt: report.completedAt,
      status: report.status,
      ipv: report.ipv,
      routes: report.routes.map((route) => ({ province: privateText(route.province), carrier: route.carrier, family: route.family, ...route.packetType ? { packetType: route.packetType } : {}, line: route.line ? privateText(route.line) : null, latency: route.latency, loss: route.loss, sent: route.sent, received: route.received, status: route.status })),
      unlocks: report.unlocks.map((unlock) => ({ service: privateText(unlock.service), family: unlock.family, status: unlock.status, region: unlock.region ? privateText(unlock.region) : null, detail: unlock.detail ? privateText(unlock.detail) : null })),
      errors: report.errors.length ? ["\u90E8\u5206\u68C0\u6D4B\u672A\u5B8C\u6210\uFF0C\u8BE6\u60C5\u8BF7\u7BA1\u7406\u5458\u67E5\u770B\u539F\u59CB\u62A5\u544A"] : []
    };
  }
  function registerRoutes(runtime) {
    const route = (method, path, handler) => import_plugin_sdk.server.route(method, `${BASE}/${path}`, async (req, res) => {
      if (path !== "public" && !isAdmin(req)) {
        reply(res, 403, { error: "\u4EC5\u7BA1\u7406\u5458\u53EF\u8BBF\u95EE" });
        return;
      }
      if (method === "POST") {
        if (header(req, "x-network-quality") !== "1" || !header(req, "content-type").toLowerCase().startsWith("application/json") || header(req, "origin") && header(req, "sec-fetch-site") !== "same-origin") {
          reply(res, 403, { error: "\u8BF7\u6C42\u6765\u6E90\u6821\u9A8C\u5931\u8D25" });
          return;
        }
        if (req.body.length > 65536) {
          reply(res, 413, { error: "\u8BF7\u6C42\u5185\u5BB9\u8FC7\u957F" });
          return;
        }
      }
      try {
        await runtime.exclusive(() => handler(req, res));
      } catch (error) {
        reply(res, 400, { error: message(error) });
      }
    });
    route("GET", "context", async (_req, res) => reply(res, 200, { version: 1, config: runtime.state.config, effective: await runtime.effective(), defaults: defaultConfig(), nodes: await runtime.nodeList(), jobs: runtime.state.jobs, provinces: PROVINCES }));
    route("POST", "config", async (req, res) => {
      const data = object(JSON.parse(req.body), "\u8BF7\u6C42");
      reply(res, 200, { config: await runtime.configure(data.config) });
    });
    route("POST", "start", async (req, res) => {
      const jobs = await runtime.enqueue(JSON.parse(req.body));
      reply(res, 202, { jobs });
    });
    route("GET", "jobs", async (req, res) => reply(res, 200, { jobs: runtime.state.jobs.filter((job) => !req.query.uuid || job.uuid === req.query.uuid) }));
    route("GET", "history", async (req, res) => reply(res, 200, { reports: runtime.history(req.query.uuid || "") }));
    route("GET", "raw", async (req, res) => {
      const report = runtime.history(req.query.uuid || "").find((item) => item.id === req.query.report_id);
      if (!report) {
        reply(res, 404, { error: "\u62A5\u544A\u4E0D\u5B58\u5728\u6216\u5DF2\u8FC7\u671F" });
        return;
      }
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Disposition", `attachment; filename="network-quality-${report.id}.txt"`);
      res.end(runtime.store.readRaw(report.id));
    });
    route("GET", "public", async (req, res) => {
      const uuid = req.query.uuid || "", nodes = await runtime.nodes(), node = nodes[uuid];
      if (!node || node.hidden === true) {
        reply(res, 404, { error: "\u8282\u70B9\u4E0D\u5B58\u5728" });
        return;
      }
      const effective = await runtime.effective();
      if (!effective.enabled || !effective.publicEnabled) {
        reply(res, 200, { version: 1, enabled: false });
        return;
      }
      const reports = runtime.history(uuid), requested = req.query.report_id;
      const latest = requested ? reports.find((report) => report.id === requested) : reports.find((report) => report.status !== "failed") || reports[0];
      if (requested && !latest) {
        reply(res, 404, { error: "\u62A5\u544A\u4E0D\u5B58\u5728\u6216\u5DF2\u8FC7\u671F" });
        return;
      }
      reply(res, 200, { version: 1, enabled: true, node: { uuid, name: node.name || uuid }, reports: reports.map((report) => ({ id: report.id, completedAt: report.completedAt, status: report.status })), latest: latest ? publicReport(latest) : null });
    });
  }
  (0, import_plugin_sdk.definePlugin)({ async load() {
    const runtime = new NetworkRuntime(import_plugin_sdk.server, new StateStore(__storageDir__));
    registerRoutes(runtime);
    import_plugin_sdk.server.cron("@every 15s", () => runtime.exclusive(() => runtime.tick()).catch((error) => console.error("network-quality: %s", message(error))));
    await runtime.exclusive(() => runtime.tick());
  } });
})();
