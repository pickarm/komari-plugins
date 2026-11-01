import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { decodeBase64Utf8, parseIpQualityJson, parseResult, parseTcpQualityCsv, readCsv, readJsonDocuments } from '../src/parsers';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const encode = (value: string) => Buffer.from(value, 'utf8').toString('base64');
const envelope = (value: unknown) => `diagnostic console\nNQ_RESULT:${encode(JSON.stringify(value))}\n`;

describe('upstream format adapters', () => {
  it('keeps real loss and RTT and prefers IPv4 large-packet results while retaining IPv6', () => {
    const routes = parseTcpQualityCsv(`\uFEFF${fixture('tcpquality.csv').replace(/\n/g, '\r\n')}`);
    expect(routes).toHaveLength(4);
    expect(routes[0]).toMatchObject({ province: '上海', carrier: '电信', family: 4, packetType: 'large', status: 'ok', latency: 180.2, loss: 6.67, sent: 30, received: 28 });
    expect(routes[1]).toMatchObject({ status: 'no-response', latency: null, loss: 100, line: null });
    expect(routes[2]).toMatchObject({ family: 6, packetType: 'standard', line: 'CMI, AS58453', loss: 3.33 });
    expect(routes[3]).toMatchObject({ status: 'unsupported', line: null, latency: null });
  });
  it('does not replace a large probe with a later standard CSV row', () => {
    const csv = fixture('tcpquality.csv');
    expect(parseTcpQualityCsv(`${csv}\n${csv.split('\n')[1]}`).find(x => x.carrier === '电信')?.latency).toBe(180.2);
  });
  it('supports CSV quoted commas, quotes and line breaks and rejects incomplete records', () => {
    expect(readCsv('a,b\r\n"one,two","line\n""quoted"""')).toEqual([['a','b'], ['one,two', 'line\n"quoted"']]);
    expect(() => readCsv('a,"incomplete')).toThrow('Truncated');
    expect(() => parseTcpQualityCsv('oops,not,the,upstream,header')).toThrow('header');
  });
  it('maps the actual Chinese Media states without classifying network failure as blocked', () => {
    const rows = parseIpQualityJson(fixture('ipquality.json'), 4);
    expect(rows.map(x => x.service)).toEqual(['TikTok', 'Disney+', 'Netflix', 'YouTube', 'PrimeVideo', 'Reddit', 'ChatGPT']);
    expect(rows.map(x => x.status)).toEqual(['available', 'unknown', 'restricted', 'restricted', 'unsupported', 'restricted', 'restricted']);
    expect(rows[0]).toMatchObject({ region: 'US', family: 4, detail: '解锁 · 原生' });
    expect(rows[1].region).toBeNull();
  });
  it('reads upstream JSON stream/pretty printing and escaped delimiters', () => {
    expect(readJsonDocuments(' {"note":"brace } and \\"quote"} \n {"Media":{}}')).toHaveLength(2);
    expect(() => readJsonDocuments('{"Media":')).toThrow('Truncated');
    expect(() => readJsonDocuments('log output {"Media":{}}')).toThrow('Unexpected');
  });
  it('does not guess unlock states when upstream returns an unrecognized value', () => {
    expect(parseIpQualityJson('{"Media":{"ChatGPT":{"Status":"new error mode","Region":"null"}}}', 6)[0]).toMatchObject({ family:6, status:'unknown', region:null });
  });
});

describe('remote result envelope', () => {
  it('decodes UTF-8 without relying on host atob/Buffer in plugin code', () => {
    expect(decodeBase64Utf8(encode('电信 🌾\n测试'))).toBe('电信 🌾\n测试');
    expect(() => decodeBase64Utf8('%%%')).toThrow();
  });
  it('collects both families and preserves preflight errors and partial module results', () => {
    const output = envelope({ version:1, mode:'detect', preflight:{ok:true, errors:[], missing:[],details:{engine:'native-pinned'}}, errors:['UNLOCKS_IPV6_RESULT_MISSING'], raw:{routesCsvBase64:encode(fixture('tcpquality.csv')),unlockJsonBase64:{4:encode(fixture('ipquality.json')),6:''}} });
    const result = parseResult(output);
    expect(result.routes).toHaveLength(4);
    expect(result.unlocks).toHaveLength(7);
    expect(result.preflight?.ok).toBe(true);
    expect(result.errors).toContain('UNLOCKS_IPV6_RESULT_MISSING');
  });
  it('returns usable route results when another module JSON is malformed', () => {
    const result = parseResult(envelope({version:1, raw:{routesCsvBase64:encode(fixture('tcpquality.csv')), unlockJsonBase64:{4:encode('{broken')}}}));
    expect(result.routes.length).toBe(4);
    expect(result.errors[0]).toContain('UNLOCKS_IPV4_PARSE_FAILED');
  });
  it('requires a complete final result marker and known version', () => {
    expect(() => parseResult('process killed by agent')).toThrow('完整结果');
    expect(() => parseResult(envelope({version:2}))).toThrow('version');
    const result = parseResult(envelope({version:1,preflight:{ok:false,errors:['DEPENDENCIES_MISSING'],missing:['nping'],details:{}}}));
    expect(result.routes).toEqual([]);
    expect(result.preflight?.missing).toEqual(['nping']);
  });
});
