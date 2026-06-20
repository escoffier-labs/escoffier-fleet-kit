import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt } from './build-prompt.mjs';

const style = {
  anchors: ['jellyfin'], anchorDir: 'anchors-v1', styleLanguage: 'SL.',
  frame: { subjectCoverage: '40-55% of the frame', negativeSpaceMin: '30%', aspect: '21:9' },
  exclusionClause: 'No honeycomb, no hexagonal or tiled pattern.',
};

test('prompt always carries the exclusion clause', () => {
  const briefs = { x: { category: 'X · Y', character: 'a lobster', action: 'reading', accentCool: 'teal', anchor: 'jellyfin', target: 't' } };
  const p = buildPrompt('x', briefs, style);
  assert.match(p, /No honeycomb/);
  assert.match(p, /hexagonal or tiled pattern/);
});

test('a character brief capitalizes its own article into the subject', () => {
  const briefs = { x: { category: 'X', character: 'a lobster chef', action: 'checking jars', accentCool: null, anchor: 'jellyfin', target: 't' } };
  assert.match(buildPrompt('x', briefs, style), /A lobster chef checking jars\./);
});

test('a vowel-article character keeps correct grammar', () => {
  const briefs = { x: { category: 'X', character: 'an inspector crab', action: 'stamping a doc', accentCool: null, anchor: 'jellyfin', target: 't' } };
  assert.match(buildPrompt('x', briefs, style), /An inspector crab stamping a doc\./);
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

test('content-safety clause is appended only when present', () => {
  const briefs = { x: { category: 'X', character: 'a crab', action: 'working', accentCool: null, anchor: 'jellyfin', target: 't' } };
  assert.doesNotMatch(buildPrompt('x', briefs, style), /undefined/);
  const withCs = { ...style, contentSafety: 'CS-CLAUSE.' };
  assert.match(buildPrompt('x', briefs, withCs), /CS-CLAUSE\.$/);
});
