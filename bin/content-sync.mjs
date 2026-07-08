// Content-aware layer: when a tool cuts a new release, draft a one-line
// kitchen-voice blurb from its actual changelog and refresh the
// "fresh from the kitchen" specials board on escoffierlabs.dev.
//
// Safety: never pushes to main. It opens (or updates) ONE pull request on a
// stable branch and pings #fleet-deploys, so an LLM-drafted line always gets a
// human merge before it goes live. Idempotent: the LLM runs once per release
// (blurbs cached in .content-state.json), so a quiet week makes no PR.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const kit = join(here, '..');
const repos = join(kit, '..');
const SITE = join(repos, 'escoffier-site');
const INDEX = join(SITE, 'src', 'pages', 'index.astro');
const STATE = join(kit, '.content-state.json');
const BRANCH = 'content/specials-refresh';

const config = JSON.parse(readFileSync(join(kit, 'sites.config.json'), 'utf-8'));
const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf-8')) : {};

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], ...opts });
}

// Display names for the board (matches the la carte names).
const NAMES = {
  brigade: 'Brigade', agentpantry: 'Agent Pantry',
  stationtrail: 'StationTrail', sourceharvest: 'SourceHarvest', miseledger: 'MiseLedger',
  'memory-doctor': 'Memory Doctor', 'bootstrap-doctor': 'Bootstrap Doctor',
  'agent-notify': 'Agent Notify', cloche: 'Cloche', 'mise-en-scene': 'Mise en Scene',
};

function latestRelease(repo) {
  try {
    const raw = sh('gh', ['api', `repos/${repo}/releases/latest`,
      '-q', '{tag: .tag_name, date: .published_at, body: .body}']);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// One short kitchen-voice phrase from the changelog, drafted by codex exec.
function draftBlurb(name, body) {
  const prompt = `You write one short line for a kitchen-themed software "specials board".
From the changelog, name the single most notable thing that shipped, as a 3 to 6 word phrase.
Rules: lowercase, present tense, concrete and specific, no period, no em dashes, no version numbers, no AI or model mentions. Do not begin with "serves", "adds", or "now". Output only the phrase.

Example good outputs: "zero-downtime key rotation", "leverage-sorted audit backlog", "trims oversize memory files".

Tool: ${name}
Changelog:
${(body || '').slice(0, 1800)}`;
  const out = join('/tmp', `cs-${process.pid}.txt`);
  try {
    sh('codex', ['exec', '--output-last-message', out], { input: prompt, timeout: 120000 });
    let line = readFileSync(out, 'utf-8').trim().split('\n').filter(Boolean).pop() || '';
    line = line.replace(/^["'\s-]+|["'.\s]+$/g, '').replace(/—|–/g, '-').toLowerCase();
    return line.split(/\s+/).slice(0, 8).join(' ') || null;
  } catch {
    return null;
  }
}

// Gather the most recently released tools.
const rels = [];
for (const [slug, cfg] of Object.entries(config)) {
  if (slug.startsWith('_') || cfg.version?.source !== 'gh-release') continue;
  const tool = cfg.repo.split('/')[1];
  const r = latestRelease(cfg.repo);
  if (!r || !r.tag) continue;
  rels.push({ tool, name: NAMES[tool] || tool, ...r });
}
rels.sort((a, b) => (a.date < b.date ? 1 : -1));
const top = rels.slice(0, 3);

// Draft blurbs only for releases we have not summarized at this tag.
let llmCalls = 0;
for (const r of top) {
  const cached = state[r.tool];
  if (cached && cached.tag === r.tag && cached.blurb) {
    r.blurb = cached.blurb;
  } else {
    r.blurb = draftBlurb(r.name, r.body) || (cached?.blurb) || 'latest release';
    state[r.tool] = { tag: r.tag, blurb: r.blurb };
    llmCalls++;
  }
}
writeFileSync(STATE, JSON.stringify(state, null, 2) + '\n');

// Build the new SPECIALS array literal.
const specials = top.map((r) => `  { name: '${r.name}', note: '${r.tag} · ${r.blurb.replace(/'/g, "\\'")}' },`).join('\n');
const block = `const SPECIALS = [\n${specials}\n];`;

const src = readFileSync(INDEX, 'utf-8');
const next = src.replace(/const SPECIALS = \[[\s\S]*?\];/, block);
if (next === src) {
  console.log('content-sync: specials board already current, no PR.');
  process.exit(0);
}

// Open or update a single review PR. Never touch main directly.
const g = (...a) => sh('git', ['-C', SITE, ...a]);
if (g('status', '--porcelain').trim()) {
  console.log('content-sync: escoffier-site working tree dirty, skipping to avoid clobber.');
  process.exit(0);
}
g('fetch', 'origin', 'main');
try { g('branch', '-D', BRANCH); } catch {}
g('checkout', '-B', BRANCH, 'origin/main');
// Apply the edit on the fresh branch (index now matches origin/main).
writeFileSync(INDEX, readFileSync(INDEX, 'utf-8').replace(/const SPECIALS = \[[\s\S]*?\];/, block));
g('add', 'src/pages/index.astro');
try {
  g('commit', '-m', 'content: refresh the specials board from latest releases');
} catch {
  console.log('content-sync: nothing to commit.');
  process.exit(0);
}
g('push', '-f', 'origin', BRANCH);

const body = `Auto-drafted from the latest release changelogs. Review the wording and merge to publish.\n\n` +
  top.map((r) => `- **${r.name}** ${r.tag}: ${r.blurb}`).join('\n') +
  `\n\nMerging deploys escoffierlabs.dev. Edit the lines here if any read wrong.`;
let prUrl = '';
try {
  const existing = sh('gh', ['pr', 'list', '--repo', 'solomonneas/escoffier-site',
    '--head', BRANCH, '--state', 'open', '--json', 'url', '-q', '.[0].url']).trim();
  if (existing) {
    prUrl = existing;
    console.log('content-sync: updated existing PR', prUrl);
  } else {
    prUrl = sh('gh', ['pr', 'create', '--repo', 'solomonneas/escoffier-site',
      '--head', BRANCH, '--base', 'main',
      '--title', 'content: refresh specials board', '--body', body]).trim();
    console.log('content-sync: opened PR', prUrl);
  }
} catch (e) {
  console.log('content-sync: PR step failed:', String(e).slice(0, 200));
}

// Ping the deploy channel with the proposal.
try {
  const lines = top.map((r) => `${r.name} ${r.tag}: ${r.blurb}`).join(' | ');
  execFileSync('agent-notify', [`specials board PR ready to review (${llmCalls} new): ${lines} ${prUrl}`.trim()],
    { stdio: 'ignore' });
} catch {}

g('checkout', 'main');
console.log(`content-sync: done, ${llmCalls} new blurb(s).`);
