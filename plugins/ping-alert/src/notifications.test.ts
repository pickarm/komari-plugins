import {describe,it,expect} from 'vitest';
import {plainText,prepareNotice,localTime} from './notifications';
describe('notification layout',()=>{
  it('preserves paragraph and break boundaries while removing rich-text formatting',()=>{
    expect(plainText('<p><strong>节点</strong></p><p>A &amp; B<br>下一行</p>')).toBe('节点\nA & B\n下一行');
  });
  it('escapes Telegram HTML once and avoids repeated title, node and timestamp inside body',()=>{
    const n=prepareNotice({event:'探测异常',message:'探测异常\n节点：A\n目标：a<b>&c\n探测时间：2026',time:'2026-11-01T00:00:00Z',emoji:'🚨',clients:[{uuid:'a'}],clientLabel:'A'},
      {notification_method:'telegram',notification_enabled:true,notification_template:'事件：{{event}}\n服务器：{{client}}\n消息：{{message}}\n时间：{{time}}'});
    expect(n.payload.message).toBe('目标：a&lt;b&gt;&amp;c');
    expect(n.preview).toContain('目标：a<b>&c');expect(n.preview).not.toContain('PingFailure');
  });
  it('does not HTML-encode other channels',()=>{
    const n=prepareNotice({event:'报告',message:'A & B',time:new Date().toISOString(),emoji:'📊'},
      {notification_method:'webhook',notification_enabled:true,notification_template:'{{message}}'});
    expect(n.payload.message).toBe('A & B');
  });
  it('uses readable UTC+8 times by default',()=>{
    expect(localTime('2026-10-31T18:39:58Z',{})).toBe('2026-11-01 02:39:58（UTC+8）');
  });
});
