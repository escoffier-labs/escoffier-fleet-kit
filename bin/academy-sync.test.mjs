import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ACADEMY_FILES, syncAcademy } from './academy-sync.mjs';

// A temp opsdeck-shaped source and escoffier-site-shaped destination.
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'academy-sync-'));
  const src = join(root, 'opsdeck');
  const dst = join(root, 'escoffier-site');
  mkdirSync(join(src, 'src', 'data', 'academy'), { recursive: true });
  mkdirSync(join(src, 'src', 'academy'), { recursive: true });
  mkdirSync(dst, { recursive: true });
  writeFileSync(join(src, 'package.json'), JSON.stringify({ name: 'ops-deck' }));
  writeFileSync(join(dst, 'package.json'), JSON.stringify({ name: 'escoffier-site' }));
  for (const rel of ACADEMY_FILES) writeFileSync(join(src, 'src', rel), `// ${rel}\n`);
  return { root, src, dst };
}

test('academy files list covers types plus the four dives and the registry', () => {
  assert.ok(ACADEMY_FILES.includes('academy/types.ts'));
  assert.ok(ACADEMY_FILES.includes('data/academy/index.ts'));
  for (const dive of ['brigade', 'escoffier-fleet', 'skillet', 'mise-en-scene']) {
    assert.ok(ACADEMY_FILES.includes(`data/academy/${dive}.ts`), `missing ${dive}`);
  }
});

test('sync mirrors every source file into the destination, creating dirs', () => {
  const { root, src, dst } = fixture();
  try {
    const { synced } = syncAcademy({ src, dst });
    assert.equal(synced.length, ACADEMY_FILES.length);
    for (const rel of ACADEMY_FILES) {
      assert.equal(readFileSync(join(dst, 'src', rel), 'utf-8'), readFileSync(join(src, 'src', rel), 'utf-8'));
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a second sync is a no-op (idempotent)', () => {
  const { root, src, dst } = fixture();
  try {
    syncAcademy({ src, dst });
    const { synced } = syncAcademy({ src, dst });
    assert.equal(synced.length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('--check reports drift instead of writing', () => {
  const { root, src, dst } = fixture();
  try {
    syncAcademy({ src, dst });
    // mutate one source file so the mirror is now stale
    writeFileSync(join(src, 'src', 'data/academy/brigade.ts'), '// changed\n');
    const { drifted, synced } = syncAcademy({ src, dst, check: true });
    assert.equal(synced.length, 0);
    assert.deepEqual(drifted, ['data/academy/brigade.ts']);
    // check mode must not have written
    assert.notEqual(readFileSync(join(dst, 'src', 'data/academy/brigade.ts'), 'utf-8'), '// changed\n');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('refuses to write to a destination that is not escoffier-site', () => {
  const { root, src, dst } = fixture();
  try {
    writeFileSync(join(dst, 'package.json'), JSON.stringify({ name: 'some-other-repo' }));
    assert.throws(() => syncAcademy({ src, dst }), /not escoffier-site/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
