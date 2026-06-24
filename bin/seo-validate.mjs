#!/usr/bin/env node
// Fleet SEO validator. Dependency-light (node:fs + node:path + regex/string HTML scan,
// no npm deps). Walks every *.html in a dist/ directory and enforces the contract in
// escoffier-fleet-kit/seo/README.md, the head emitted by seo/Seo.astro.
//
// Per page, HARD checks (any failure => non-zero exit):
//   - exactly one <title>
//   - exactly one <meta name="description">
//   - exactly one <link rel="canonical">, absolute, on the page's production origin,
//     with NO trailing slash on sub-paths (root '/' is allowed)
//   - at least one og:image
//   - every <img> has a non-empty alt
//   - every <script type="application/ld+json"> block JSON.parses
// Cross-page HARD check:
//   - no duplicate <title> strings, no duplicate description strings (the duplicate-meta
//     defect that drifting hand-rolled heads keep reintroducing)
// WARN-only (does not fail the build):
//   - <title> length outside 10-65
//   - description length outside 80-165
//
// Production origin: taken from the dist's own robots.txt "Sitemap:" line or
// sitemap.xml first <loc> (the host baked in at build time), or --origin <url>, or
// inferred from the canonical tags themselves (and then required to be consistent).
//
// Usage:  node seo-validate.mjs [distDir] [--origin https://host] [--quiet]
//   distDir defaults to ./dist

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// ---- tiny ANSI (no deps; honor NO_COLOR / non-TTY) ----
const COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (COLOR ? `\x1b[${code}m${s}\x1b[0m` : s);
const red = (s) => c('31', s);
const green = (s) => c('32', s);
const yellow = (s) => c('33', s);
const bold = (s) => c('1', s);

// ---- args ----
const args = process.argv.slice(2);
let distDir = './dist';
let originOverride = null;
let quiet = false;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--origin') originOverride = args[++i];
  else if (a.startsWith('--origin=')) originOverride = a.slice('--origin='.length);
  else if (a === '--quiet') quiet = true;
  else if (a === '-h' || a === '--help') {
    console.log('usage: seo-validate.mjs [distDir] [--origin https://host] [--quiet]');
    process.exit(0);
  } else if (!a.startsWith('-')) distDir = a;
}

if (!existsSync(distDir) || !statSync(distDir).isDirectory()) {
  console.error(red(`x dist directory not found: ${distDir}`));
  console.error('  run the site build first (npm run build), then point this at ./dist');
  process.exit(2);
}

// ---- recursive *.html walk ----
function walkHtml(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkHtml(full, acc);
    else if (st.isFile() && name.toLowerCase().endsWith('.html')) acc.push(full);
  }
  return acc;
}

// ---- HTML scan helpers (string/regex; we only care about the <head> meta + <img>) ----

// Strip HTML comments so commented-out tags never count.
const stripComments = (html) => html.replace(/<!--[\s\S]*?-->/g, '');

// Pull attribute value from a single tag string. Handles "double", 'single', and
// bare (unquoted) values. Returns null if absent.
function attr(tag, name) {
  const re = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i');
  const m = tag.match(re);
  if (!m) return null;
  return m[2] ?? m[3] ?? m[4] ?? '';
}

// All occurrences of a tag (e.g. "meta", "img", "link"). Returns array of full tag strings.
function tags(html, tagName) {
  const re = new RegExp(`<${tagName}\\b[^>]*>`, 'gi');
  return html.match(re) || [];
}

// <meta> tags whose key attr (name|property) equals key (case-insensitive).
function metaBy(html, key, keyAttr = 'name') {
  return tags(html, 'meta').filter((t) => {
    const v = attr(t, keyAttr);
    return v != null && v.toLowerCase() === key.toLowerCase();
  });
}

// <title>...</title> contents (there should be exactly one).
function titles(html) {
  const re = /<title\b[^>]*>([\s\S]*?)<\/title>/gi;
  const out = [];
  let m;
  while ((m = re.exec(html))) out.push(decodeEntities(m[1].trim()));
  return out;
}

// JSON-LD script blocks: contents between the script tags.
function ldBlocks(html) {
  const re = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const out = [];
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

// Minimal entity decode for the handful that show up in titles/descriptions.
function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

// ---- production origin resolution ----
function normOrigin(u) {
  try {
    return new URL(u).origin;
  } catch {
    return null;
  }
}

function originFromRobots(dir) {
  const p = join(dir, 'robots.txt');
  if (!existsSync(p)) return null;
  const m = readFileSync(p, 'utf8').match(/^\s*Sitemap:\s*(\S+)/im);
  return m ? normOrigin(m[1]) : null;
}

function originFromSitemap(dir) {
  const p = join(dir, 'sitemap.xml');
  if (!existsSync(p)) return null;
  const m = readFileSync(p, 'utf8').match(/<loc>\s*([^<\s]+)\s*<\/loc>/i);
  return m ? normOrigin(m[1]) : null;
}

// Infer from the canonical tags themselves: the single origin shared by all canonicals.
function originFromCanonicals(pages) {
  const origins = new Set();
  for (const pg of pages) {
    for (const link of tags(pg.html, 'link')) {
      if ((attr(link, 'rel') || '').toLowerCase() === 'canonical') {
        const o = normOrigin(attr(link, 'href') || '');
        if (o) origins.add(o);
      }
    }
  }
  return origins.size === 1 ? [...origins][0] : null;
}

// ---- canonical sub-path rule ----
// Absolute, on production origin, and NO trailing slash on sub-paths. Root '/' allowed.
function canonicalIssue(href, origin) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return `canonical is not an absolute URL: "${href}"`;
  }
  if (url.origin !== origin) {
    return `canonical origin ${url.origin} != production origin ${origin}`;
  }
  const path = url.pathname;
  if (path !== '/' && path.endsWith('/')) {
    return `canonical sub-path has a trailing slash (trailingSlash:'never'): "${path}"`;
  }
  return null;
}

// ---- per-page checks ----
function checkPage(file, rawHtml, origin) {
  const html = stripComments(rawHtml);
  const errors = [];
  const warnings = [];

  // Skip intentionally non-indexed pages (og-card render routes, preview pages, etc.).
  // They are not meant to rank, so the head contract does not apply.
  const robots = metaBy(html, 'robots', 'name')
    .map((m) => (attr(m, 'content') || '').toLowerCase())
    .join(' ');
  if (robots.includes('noindex')) {
    return { file, errors: [], warnings: [], title: null, description: null, skipped: true };
  }

  // title: exactly one
  const t = titles(html);
  if (t.length === 0) errors.push('missing <title>');
  else if (t.length > 1) errors.push(`${t.length} <title> tags (expected exactly 1)`);
  const title = t[0] ?? null;
  if (title != null) {
    if (title.length === 0) errors.push('<title> is empty');
    else if (title.length < 10 || title.length > 65)
      warnings.push(`<title> length ${title.length} out of band (want 10-65): "${title}"`);
  }

  // description: exactly one
  const descTags = metaBy(html, 'description', 'name');
  if (descTags.length === 0) errors.push('missing <meta name="description">');
  else if (descTags.length > 1)
    errors.push(`${descTags.length} <meta name="description"> tags (expected exactly 1)`);
  let description = null;
  if (descTags.length >= 1) {
    description = decodeEntities((attr(descTags[0], 'content') || '').trim());
    if (description.length === 0) errors.push('<meta name="description"> is empty');
    else if (description.length < 80 || description.length > 165)
      warnings.push(`description length ${description.length} out of band (want 80-165)`);
  }

  // canonical: exactly one, absolute, on origin, no trailing slash on sub-paths
  const canon = tags(html, 'link').filter(
    (l) => (attr(l, 'rel') || '').toLowerCase() === 'canonical'
  );
  if (canon.length === 0) errors.push('missing <link rel="canonical">');
  else if (canon.length > 1)
    errors.push(`${canon.length} <link rel="canonical"> tags (expected exactly 1)`);
  if (canon.length >= 1) {
    const href = attr(canon[0], 'href') || '';
    const issue = canonicalIssue(href, origin);
    if (issue) errors.push(issue);
  }

  // og:image: at least one (property="og:image")
  const ogImages = metaBy(html, 'og:image', 'property');
  if (ogImages.length === 0) errors.push('no <meta property="og:image">');
  else if (ogImages.some((m) => !(attr(m, 'content') || '').trim()))
    errors.push('<meta property="og:image"> has empty content');

  // every <img> has a non-empty alt
  for (const img of tags(html, 'img')) {
    const alt = attr(img, 'alt');
    if (alt == null) errors.push(`<img> missing alt attribute: ${img.slice(0, 100)}`);
    else if (alt.trim() === '') errors.push(`<img> has empty alt: ${img.slice(0, 100)}`);
  }

  // every JSON-LD block parses
  ldBlocks(html).forEach((block, i) => {
    const text = block.trim();
    if (!text) {
      errors.push(`application/ld+json block #${i + 1} is empty`);
      return;
    }
    try {
      JSON.parse(text);
    } catch (e) {
      errors.push(`application/ld+json block #${i + 1} does not JSON.parse: ${e.message}`);
    }
  });

  return { file, errors, warnings, title, description };
}

// ---- main ----
const htmlFiles = walkHtml(distDir).sort();
if (htmlFiles.length === 0) {
  console.error(red(`x no *.html files found under ${distDir}`));
  process.exit(2);
}

const pages = htmlFiles.map((f) => ({ file: f, html: readFileSync(f, 'utf8') }));

const origin =
  (originOverride && normOrigin(originOverride)) ||
  originFromRobots(distDir) ||
  originFromSitemap(distDir) ||
  originFromCanonicals(pages);

if (!origin) {
  console.error(red('x could not determine production origin.'));
  console.error(
    '  provide one with --origin https://host, or ship a robots.txt (Sitemap:) /'
  );
  console.error('  sitemap.xml, or emit consistent absolute <link rel="canonical"> tags.');
  process.exit(2);
}

const results = pages.map((p) => checkPage(p.file, p.html, origin));

// ---- cross-page duplicate detection ----
const byTitle = new Map();
const byDesc = new Map();
for (const r of results) {
  const rel = relative(distDir, r.file) || r.file;
  if (r.title) {
    if (!byTitle.has(r.title)) byTitle.set(r.title, []);
    byTitle.get(r.title).push(rel);
  }
  if (r.description) {
    if (!byDesc.has(r.description)) byDesc.set(r.description, []);
    byDesc.get(r.description).push(rel);
  }
}
const dupTitles = [...byTitle.entries()].filter(([, files]) => files.length > 1);
const dupDescs = [...byDesc.entries()].filter(([, files]) => files.length > 1);

// ---- report ----
let hardFailures = 0;
let warnCount = 0;

let skippedCount = 0;
for (const r of results) {
  const rel = relative(distDir, r.file) || r.file;
  if (r.skipped) {
    skippedCount++;
    if (!quiet) console.log(`${yellow('skip')} ${rel} (noindex)`);
  } else if (r.errors.length === 0 && r.warnings.length === 0) {
    if (!quiet) console.log(`${green('ok')} ${rel}`);
  } else {
    const tag = r.errors.length ? red('FAIL') : yellow('warn');
    console.log(`${tag} ${rel}`);
    for (const e of r.errors) console.log(`     ${red('x')} ${e}`);
    for (const w of r.warnings) console.log(`     ${yellow('!')} ${w}`);
  }
  hardFailures += r.errors.length;
  warnCount += r.warnings.length;
}

if (dupTitles.length || dupDescs.length) {
  console.log('');
  console.log(red('FAIL cross-page duplicate meta:'));
  for (const [title, files] of dupTitles) {
    console.log(`     ${red('x')} duplicate <title> "${title}" on: ${files.join(', ')}`);
    hardFailures++;
  }
  for (const [desc, files] of dupDescs) {
    const short = desc.length > 60 ? desc.slice(0, 60) + '...' : desc;
    console.log(`     ${red('x')} duplicate description "${short}" on: ${files.join(', ')}`);
    hardFailures++;
  }
}

// ---- summary ----
console.log('');
const pageWord = htmlFiles.length === 1 ? 'page' : 'pages';
if (hardFailures === 0) {
  let line = green(`SEO OK: ${htmlFiles.length} ${pageWord} clean on ${origin}`);
  if (warnCount > 0) line += yellow(` (${warnCount} warning${warnCount === 1 ? '' : 's'})`);
  console.log(bold(line));
  process.exit(0);
} else {
  console.log(
    bold(
      red(
        `SEO FAILED: ${hardFailures} hard check${hardFailures === 1 ? '' : 's'} across ` +
          `${htmlFiles.length} ${pageWord} on ${origin}` +
          (warnCount ? ` (+${warnCount} warning${warnCount === 1 ? '' : 's'})` : '')
      )
    )
  );
  process.exit(1);
}
