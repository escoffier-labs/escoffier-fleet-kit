import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const script = readFileSync(new URL('./fleet-sync.sh', import.meta.url), 'utf8');

test('fleet sync publishes only from the deploy branch', () => {
  assert.match(script, /checkout main|switch main/);
  assert.doesNotMatch(script, /push --quiet origin "\$branch"/);
});

