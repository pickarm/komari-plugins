import fs from 'node:fs';
import assert from 'node:assert/strict';

const catalog = JSON.parse(fs.readFileSync('v1.json', 'utf8'));
assert.equal(catalog.schema, 1);
assert.ok(Array.isArray(catalog.plugins));
const shorts = catalog.plugins.map(p => p.short.toLowerCase());
assert.equal(new Set(shorts).size, shorts.length, 'Duplicate short names');
assert.deepEqual(shorts, [...shorts].sort(), 'Catalog must be sorted by short');
for (const plugin of catalog.plugins) {
  assert.match(plugin.short, /^[a-z0-9-]+$/);
  assert.match(plugin.sha256, /^[0-9a-f]{64}$/);
  assert.equal(new URL(plugin.download).protocol, 'https:');
  const manifest = JSON.parse(fs.readFileSync(`plugins/${plugin.short}/komari-plugin.json`, 'utf8'));
  for (const field of ['short', 'version', 'komari']) assert.equal(plugin[field], manifest[field]);
  assert.ok(fs.existsSync(`plugins/${plugin.short}/${manifest.entry || 'script.js'}`));
}
console.log(`Validated ${catalog.plugins.length} plugin catalog entries`);
