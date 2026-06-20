import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt } from './build-prompt.mjs';

const style = {
  anchors: ['jellyfin'], anchorDir: 'anchors-v1', styleLanguage: 'SL.',
  frame: { subjectCoverage: '40-55% of the frame', negativeSpaceMin: '30%', aspect: '21:9' },
  exclusionClause: 'No honeycomb, no hexagonal or tiled pattern.',
};

test('prompt always carries the exclusion clause', () => {
  const briefs = { x: { category: 'X · Y', character: 'lobster', action: 'reading', accentCool: 'teal', anchor: 'jellyfin', target: 't' } };
  const p = buildPrompt('x', briefs, style);
  assert.match(p, /No honeycomb/);
  assert.match(p, /hexagonal or tiled pattern/);
});

test('a character brief produces a subject sentence', () => {
  const briefs = { x: { category: 'X', character: 'lobster chef', action: 'checking jars', accentCool: null, anchor: 'jellyfin', target: 't' } };
  assert.match(buildPrompt('x', briefs, style), /A lobster chef checking jars\./);
});

test('a flatlay brief (character null) uses flatlay phrasing', () => {
  const briefs = { x: { category: 'X', character: null, action: 'an investigator desk', accentCool: 'teal', anchor: 'jellyfin', target: 't' } };
  const p = buildPrompt('x', briefs, style);
  assert.match(p, /loose watercolor flatlay/);
  assert.doesNotMatch(p, /A null/);
});

test('unknown slug throws', () => {
  assert.throws(() => buildPrompt('nope', {}, style), /No brief for slug/);
});

test('unknown anchor throws', () => {
  const briefs = { x: { category: 'X', character: 'crab', action: 'a', accentCool: null, anchor: 'bogus', target: 't' } };
  assert.throws(() => buildPrompt('x', briefs, style), /unknown anchor/);
});
