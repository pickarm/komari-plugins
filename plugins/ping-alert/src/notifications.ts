import {bool, str, number, type Config} from './config';
export type Notice = {event:string; code?:string; message:string; time:string; emoji:string;
  clients?:{uuid:string}[]; clientLabel?:string; metrics?:string};
export const reportMetrics = (c:Config) => ({ping:bool(c.enabled,true),loss:bool(c.loss_enabled,false)});
export const metricKey = (c:Config) => {const f=reportMetrics(c);return `${f.ping?'p':''}${f.loss?'l':''}`;};
export const htmlEscape = (s:string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
export function plainText(s:string) {
  return s.replace(/\r\n?/g,'\n').replace(/<br\s*\/?\s*>/gi,'\n')
    .replace(/<\/(?:p|div|li|h[1-6]|blockquote)>/gi,'\n')
    .replace(/<\/?(?:p|div|li|ul|ol|h[1-6]|blockquote|strong|b|em|i|u|s|span|pre|code|a)(?:\s[^>]*?)?>/gi,'')
    .replace(/&nbsp;/gi,' ').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/&amp;/gi,'&')
    .replace(/\n[ \t]+/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
export function localTime(iso:string, c:Config) {
  const offset=number(c.notice_utc_offset,8,-12,14),d=new Date(Date.parse(iso)+offset*3600000);
  const pad=(n:number)=>String(n).padStart(2,'0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}（UTC${offset>=0?'+':''}${offset}）`;
}
export function prepareNotice(event:Notice, settings:Config) {
  const outer = str(settings.notification_template,'{{emoji}}{{emoji}}{{emoji}}\nEvent: {{event}}\nClients: {{client}}\nMessage: {{message}}\nTime: {{time}}');
  const telegram=str(settings.notification_method)==='telegram';
  // Templates are normalized before inserting variable values; never strip literal data as HTML.
  let body=event.message.replace(/\r\n?/g,'\n').trim();
  if (outer.includes('{{event}}') || telegram) {
    if(body.startsWith(event.event+'\n')) body=body.slice(event.event.length+1);
  }
  if (event.clients?.length && /\{\{clients?\}\}/.test(outer)) body=body.split('\n').filter(l=>!l.startsWith('节点：')).join('\n');
  if (outer.includes('{{time}}')) body=body.split('\n').filter(l=>!l.startsWith('探测时间：')&&!l.startsWith('通知时间：')).join('\n');
  const payload={...event,message:telegram?htmlEscape(body):body};
  // This mirrors Komari's global substitution order for an on-screen approximation.
  const d=new Date(event.time),pad=(n:number)=>String(n).padStart(2,'0');
  const time=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const values:Record<string,string>={emoji:event.emoji,event:event.event,client:event.clientLabel||'',clients:event.clientLabel||'',message:payload.message,time};
  const rendered=outer.replace(/\{\{(emoji|event|clients?|message|time)\}\}/g,(_,k:string)=>values[k]);
  const wire=telegram?`<b>${htmlEscape(event.event)}</b>\n${rendered}`:rendered;
  return {payload,preview:plainText(wire),raw:wire,channel:str(settings.notification_method,'none'),
    ready:bool(settings.notification_enabled,false)&&!['','none'].includes(str(settings.notification_method,'none'))};
}
