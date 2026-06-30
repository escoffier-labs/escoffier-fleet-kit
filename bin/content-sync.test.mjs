import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const script = readFileSync(new URL('./content-sync.mjs', import.meta.url), 'utf8');

test('content sync persists release state only after updating the PR branch', () => {
  const stateWrite = script.indexOf('writeFileSync(STATE');
  const branchPush = script.indexOf("g('push', '-f', 'origin', BRANCH)");

  assert.notEqual(stateWrite, -1);
  assert.notEqual(branchPush, -1);
  assert.ok(stateWrite > branchPush, 'state cache must be written after the PR branch is pushed');
});

test('content sync refreshes an existing review PR body', () => {
  assert.match(script, /pr', 'edit'/);
});

test('content sync can merge after PR checks in scheduled mode', () => {
  assert.match(script, /ESCOFFIER_CONTENT_SYNC_AUTO_MERGE/);
  assert.match(script, /pr', 'checks'/);
  assert.match(script, /pr', 'merge'/);
  assert.doesNotMatch(script, /--auto/);
});
