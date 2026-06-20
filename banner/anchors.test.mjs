import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'anchors-v1');

test('exactly the three frozen anchors are present', () => {
  const names = readdirSync(dir)
    .filter((f) => /\.(jpg|png)$/i.test(f))
    .map((f) => f.replace(/\.(jpg|png)$/i, ''))
    .sort();
  assert.deepEqual(names, ['jellyfin', 'tokenjuice', 'usage-tracker']);
});

test('checksums match SHA256SUMS (immutability guard)', () => {
  const lines = readFileSync(join(dir, 'SHA256SUMS'), 'utf-8').trim().split('\n');
  assert.ok(lines.length === 3, 'expected three checksum lines');
  for (const line of lines) {
    const [hash, name] = line.trim().split(/\s+/);
    const actual = createHash('sha256').update(readFileSync(join(dir, name))).digest('hex');
    assert.equal(actual, hash, `checksum drift on ${name}`);
  }
});
