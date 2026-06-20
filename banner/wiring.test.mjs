import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));

test('package.json wires the banner and test scripts', () => {
  assert.equal(pkg.scripts.banner, 'node banner/build-prompt.mjs');
  assert.match(pkg.scripts.test, /node --test/);
});

test('ILLUSTRATION.md exists and names style.json as the source of truth', () => {
  assert.ok(existsSync(join(root, 'ILLUSTRATION.md')));
  const doc = readFileSync(join(root, 'ILLUSTRATION.md'), 'utf-8');
  assert.match(doc, /banner\/style\.json/);
  assert.match(doc, /#e0a45c/);
});
