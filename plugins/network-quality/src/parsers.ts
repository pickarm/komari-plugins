import type { ParsedResult, Preflight, RouteResult, UnlockResult } from './types';

const MAX_PAYLOAD = 4 * 1024 * 1024;
type JsonObject = Record<string, unknown>;
function object(value: unknown): JsonObject { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {}; }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string').slice(0, 200) : []; }
function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const result = value.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').trim();
  return !result || /^(?:null|undefined|N\/A|NA|—|--|-)$/i.test(result) ? null : result.slice(0, 1000);
}

/** Does not depend on Buffer/atob/TextDecoder, which are absent from Komari's JS VM. */
export function decodeBase64Utf8(encoded: string): string {
  if (encoded.length > MAX_PAYLOAD * 2 || encoded.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new Error('Invalid base64 result');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const output: string[] = [];
  for (let i = 0; i < encoded.length; i += 4) {
    const a = alphabet.indexOf(encoded[i]);
    const b = alphabet.indexOf(encoded[i + 1]);
    const c = alphabet.indexOf(encoded[i + 2]);
    const d = alphabet.indexOf(encoded[i + 3]);
    if (a < 0 || b < 0) throw new Error('Invalid base64 padding');
    output.push(`%${((a << 2) | (b >> 4)).toString(16).padStart(2, '0')}`);
    if (encoded[i + 2] !== '=') output.push(`%${(((b & 15) << 4) | (c >> 2)).toString(16).padStart(2, '0')}`);
    if (encoded[i + 3] !== '=') output.push(`%${(((c & 3) << 6) | d).toString(16).padStart(2, '0')}`);
  }
  return decodeURIComponent(output.join(''));
}

/** RFC4180 quoting, UTF-8 BOM and CRLF, including quoted commas/newlines. */
export function readCsv(csv: string): string[][] {
  if (csv.length > MAX_PAYLOAD) throw new Error('CSV result too large');
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  const input = csv.replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"') {
      if (quoted && input[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(cell); if (row.some(x => x.trim())) rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (quoted) throw new Error('Truncated CSV quoted value');
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function finite(value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !text(value)) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

export function parseTcpQualityCsv(csv: string): RouteResult[] {
  const rows = readCsv(csv);
  const headerIndex = rows.findIndex(row => row.includes('运营商') && row.includes('状态'));
  if (headerIndex < 0) throw new Error('TcpQuality CSV header missing');
  const header = rows[headerIndex];
  const column = (row: string[], name: string): string | undefined => row[header.indexOf(name)];
  const results = new Map<string, RouteResult>();
  for (const row of rows.slice(headerIndex + 1)) {
    const carrier = column(row, '运营商');
    if (carrier !== '电信' && carrier !== '联通' && carrier !== '移动') continue;
    const network = column(row, '网络');
    if (network !== '三网' && network !== 'IPv4大包') continue;
    const familyText = column(row, 'IP版本');
    if (familyText !== 'IPv4' && familyText !== 'IPv6') continue;
    const province = text(column(row, '省份'));
    if (!province) continue;
    const family = familyText === 'IPv4' ? 4 : 6;
    const sourceStatus = column(row, '状态')?.toUpperCase();
    const sent = finite(column(row, '发送'), 0);
    const received = finite(column(row, '收到'), 0);
    const loss = finite(column(row, '丢包率(%)'), 0, 100);
    const responded = received !== null && received > 0;
    const status: RouteResult['status'] = sourceStatus === 'SKIP' ? 'unsupported'
      : sourceStatus === 'OK' && responded ? 'ok'
      : sent !== null && sent > 0 && received === 0 ? 'no-response' : 'failed';
    const lineText = text(column(row, '线路'));
    const line = lineText && !/^(?:Hidden|failed|unknown)$/i.test(lineText) ? lineText : null;
    const key = `${province}:${carrier}:${family}`;
    const packetType: NonNullable<RouteResult['packetType']> = network === 'IPv4大包' ? 'large' : 'standard';
    if (packetType === 'standard' && results.get(key)?.packetType === 'large') continue;
    results.set(key, Object.assign({
      province, carrier, family, line,
      latency: responded ? finite(column(row, '平均延迟ms'), 0) : null,
      loss, sent, received, status,
    } satisfies RouteResult, { packetType }));
  }
  return [...results.values()];
}

/** IPQuality appends a JSON document per family; parse complete concatenated documents. */
export function readJsonDocuments(source: string): unknown[] {
  if (source.length > MAX_PAYLOAD) throw new Error('IPQuality result too large');
  const result: unknown[] = [];
  let start = -1, depth = 0, quoted = false, escaped = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (start < 0) {
      if (/\s|\uFEFF/.test(char)) continue;
      if (char !== '{' && char !== '[') throw new Error('Unexpected text in JSON result');
      start = i; depth = 1; continue;
    }
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '{' || char === '[') depth++;
    else if (char === '}' || char === ']') {
      depth--;
      if (depth === 0) { result.push(JSON.parse(source.slice(start, i + 1))); start = -1; }
    }
  }
  if (start !== -1) throw new Error('Truncated JSON result');
  return result;
}

export function parseIpQualityJson(source: string, family: 4 | 6): UnlockResult[] {
  const result = new Map<string, UnlockResult>();
  const aliases: Record<string, string> = { DisneyPlus: 'Disney+', Youtube: 'YouTube', AmazonPrimeVideo: 'PrimeVideo' };
  for (const doc of readJsonDocuments(source)) {
    const media = object(object(doc).Media);
    for (const [name, raw] of Object.entries(media)) {
      const data = object(raw);
      const detailStatus = text(data.Status);
      const type = text(data.Type);
      const region = text(data.Region);
      let status: UnlockResult['status'] = 'unknown';
      // A timeout/failure is unknown, not an assertion that the service blocks this IP.
      if (detailStatus && /^(?:解锁|Yes|Available|Unlocked)$/i.test(detailStatus)) status = 'available';
      else if (detailStatus && /^(?:待支持|Unsupported|Pending)$/i.test(detailStatus)) status = 'unsupported';
      else if (detailStatus && /^(?:屏蔽|仅自制|仅网页|仅APP|机房|禁会员|中国|No|Blocked|Restricted|Originals?\s*Only|Org\.?|NoPrem\.?|Web\s*Only|App\s*Only|IDC|China)$/i.test(detailStatus)) status = 'restricted';
      const service = aliases[name] ?? name;
      result.set(service, { service, family, status, region, detail: [detailStatus, type].filter(Boolean).join(' · ') || null });
    }
  }
  return [...result.values()];
}

export function parseResult(output: string): ParsedResult {
  if (typeof output !== 'string' || output.length > MAX_PAYLOAD * 3) throw new Error('Detection output missing or too large');
  const matches = [...output.matchAll(/(?:^|\r?\n)NQ_RESULT:([A-Za-z0-9+/=]+)(?=\r?\n|$)/g)];
  if (!matches.length) throw new Error('检测未返回完整结果标记，请查看管理员执行日志');
  const source = object(JSON.parse(decodeBase64Utf8(matches[matches.length - 1][1])));
  if (source.version !== 1) throw new Error('Unsupported detection result version');
  const raw = object(source.raw);
  const errors = strings(source.errors);
  let routes: RouteResult[] = [], unlocks: UnlockResult[] = [];
  if (typeof raw.routesCsvBase64 === 'string' && raw.routesCsvBase64) {
    try { routes = parseTcpQualityCsv(decodeBase64Utf8(raw.routesCsvBase64)); }
    catch (error) { errors.push(`ROUTES_PARSE_FAILED: ${String(error)}`); }
  }
  const unlockSources = object(raw.unlockJsonBase64);
  for (const family of [4, 6] as const) {
    const encoded = unlockSources[String(family)];
    if (typeof encoded === 'string' && encoded) {
      try { unlocks.push(...parseIpQualityJson(decodeBase64Utf8(encoded), family)); }
      catch (error) { errors.push(`UNLOCKS_IPV${family}_PARSE_FAILED: ${String(error)}`); }
    }
  }
  const pre = object(source.preflight);
  const details: Record<string, string> = {};
  for (const [key, value] of Object.entries(object(pre.details))) if (typeof value === 'string') details[key] = value.slice(0, 500);
  const preflight: Preflight = { ok: pre.ok === true, errors: strings(pre.errors), missing: strings(pre.missing), details };
  const engines: Record<string, string> = {};
  for (const [key, value] of Object.entries(object(source.engines))) if (typeof value === 'string') engines[key] = value.slice(0, 100);
  return { version: 1, mode: typeof source.mode === 'string' ? source.mode : undefined, preflight, routes, unlocks, errors, engines };
}
