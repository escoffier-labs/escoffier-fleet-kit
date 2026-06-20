import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const style = JSON.parse(readFileSync(new URL('./style.json', import.meta.url)));

test('palette carries the exact brand tokens', () => {
  assert.equal(style.palette.ink, '#0d1014');
  assert.equal(style.palette.amber, '#e0a45c');
  assert.equal(style.palette.cream, '#f5f2ea');
  assert.equal(style.palette.slateNavy, '#1d2733');
});

test('exclusion clause bans the whole hex family', () => {
  const c = style.exclusionClause.toLowerCase();
  for (const term of ['honeycomb', 'hexagonal', 'tiled', 'repeating cells', 'mosaic', 'mesh', 'brickwork', 'mechanical panels', 'dotted grid', 'over-rendered']) {
    assert.ok(c.includes(term), `exclusion clause missing: ${term}`);
  }
});

test('anchors are exactly the three frozen clean sources', () => {
  assert.deepEqual([...style.anchors].sort(), ['jellyfin', 'tokenjuice', 'usage-tracker']);
});

test('content-safety clause forbids PII and private IPs', () => {
  const c = style.contentSafety.toLowerCase();
  for (const term of ['placeholder', 'personal', 'private ip', '192.0.2']) {
    assert.ok(c.includes(term), `content safety missing: ${term}`);
  }
});
