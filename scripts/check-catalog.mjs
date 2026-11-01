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
  for (const field of ['short', 'komari']) assert.equal(plugin[field], manifest[field]);
  // The catalog keeps the last verified release while newer source is being built.
  // Never point users at an unbuilt artifact just to keep source and catalog in sync.
  assert.match(plugin.version, /^\d+\.\d+\.\d+$/);
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  const published = plugin.version.split('.').map(Number), source = manifest.version.split('.').map(Number);
  const different = source.findIndex((part, index) => part !== published[index]);
  assert.ok(different < 0 || source[different] > published[different], 'Catalog cannot be ahead of source');
  const download = new URL(plugin.download);
  assert.equal(download.hostname, 'github.com');
  assert.ok(download.pathname.endsWith(`/releases/download/${plugin.short}-v${plugin.version}/${plugin.short}-${plugin.version}.zip`), 'Catalog release URL must match its published version');
  assert.ok(fs.existsSync(`plugins/${plugin.short}/${manifest.entry || 'script.js'}`));
}
console.log(`Validated ${catalog.plugins.length} plugin catalog entries`);
