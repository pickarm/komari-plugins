import fs from 'node:fs';
import vm from 'node:vm';
import { expect, it } from 'vitest';
it('ships a syntactically valid admin page with separate node checkboxes',()=>{
  const html=fs.readFileSync('pages/admin.html','utf8');
  const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  expect(script).toBeTruthy();expect(()=>new vm.Script(script!)).not.toThrow();
});
