// Read each tool's authoritative version and patch SITE.version in its site repo.
// Prints a JSON summary of what changed so the runner can decide whether to commit.
// Usage: node bin/sync-versions.mjs        (apply)
//        node bin/sync-versions.mjs --dry   (report only)
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const kit = join(here, '..');
const repos = join(kit, '..');
const dry = process.argv.includes('--dry');
const config = JSON.parse(readFileSync(join(kit, 'sites.config.json'), 'utf-8'));
const selectedSites = new Set(
  (process.env.ESCOFFIER_FLEET_SITES || '')
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean),
);

function ghLatestTag(repo) {
  try {
    const out = execFileSync('gh', ['api', `repos/${repo}/releases/latest`, '-q', '.tag_name'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return out || null;
  } catch {
    return null; // no releases yet, or no access
  }
}

function skillCount(repo, skillsDir) {
  // Count immediate skill subdirectories in the tool repo working copy.
  const toolPath = join(repos, repo.split('/')[1]);
  const dir = join(toolPath, skillsDir);
  if (!existsSync(dir)) return null;
  return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).length;
}

function desiredVersion(cfg, current) {
  const v = cfg.version;
  if (v.source === 'gh-release') {
    const tag = ghLatestTag(cfg.repo);
    if (!tag) return null;
    const bare = tag.replace(/^v/, '');
    // Preserve the site's own convention: if it currently shows a leading v, keep it.
    const prefix = /^v\d/.test(current) ? 'v' : '';
    return prefix + bare;
  }
  if (v.source === 'skill-count') {
    const n = skillCount(cfg.repo, v.skillsDir);
    if (n == null) return null;
    return `${n}${v.suffix || ''}`;
  }
  return null; // manual
}

const summary = [];
for (const [slug, cfg] of Object.entries(config)) {
  if (slug.startsWith('_')) continue;
  if (selectedSites.size > 0 && !selectedSites.has(slug)) continue;
  const siteTs = join(repos, slug, 'src', 'lib', 'site.ts');
  if (!existsSync(siteTs)) {
    summary.push({ slug, status: 'no-site-ts' });
    continue;
  }
  const src = readFileSync(siteTs, 'utf-8');
  const m = src.match(/version:\s*'([^']*)'/);
  if (!m) {
    summary.push({ slug, status: 'version-field-not-found' });
    continue;
  }
  const current = m[1];
  const want = desiredVersion(cfg, current);
  if (want == null) {
    summary.push({ slug, status: cfg.version.source === 'manual' ? 'manual' : 'no-version-source' });
    continue;
  }
  if (current === want) {
    summary.push({ slug, status: 'current', version: current });
    continue;
  }
  summary.push({ slug, status: 'changed', from: current, to: want });
  if (!dry) {
    writeFileSync(siteTs, src.replace(/version:\s*'[^']*'/, `version: '${want}'`));
  }
}

console.log(JSON.stringify({ dry, summary }, null, 2));
