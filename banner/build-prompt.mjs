// Assemble the GPT Image 2 prompt for a repo banner from shared style + per-project brief.
// Usage: node banner/build-prompt.mjs <slug>     (print prompt, write provenance sidecar)
//        node banner/build-prompt.mjs --all       (every slug)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const reposRoot = join(here, '..', '..');
const defaultStyle = JSON.parse(readFileSync(join(here, 'style.json'), 'utf-8'));
const defaultBriefs = JSON.parse(readFileSync(join(here, 'briefs.json'), 'utf-8'));

export function buildPrompt(slug, briefs = defaultBriefs, style = defaultStyle) {
  const b = briefs[slug];
  if (!b) throw new Error(`No brief for slug: ${slug}`);
  if (!style.anchors.includes(b.anchor)) throw new Error(`Brief ${slug} uses unknown anchor: ${b.anchor}`);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const subject = b.character ? `${cap(b.character)} ${b.action}.` : `A loose watercolor flatlay: ${b.action}.`;
  const accent = b.accentCool
    ? `Warm amber accent plus a single cool ${b.accentCool} accent; no third hue.`
    : 'Warm amber accent only; keep it nearly monochrome cream and ink.';
  const composition = `Composition: subject ${style.frame.subjectCoverage}; at least ${style.frame.negativeSpaceMin} bare paper; aspect ${style.frame.aspect}.`;
  const kicker = `Small monospaced amber caps top-left reading "[ ${b.category} ]", with clear space around it.`;
  const parts = [subject, style.styleLanguage, accent, composition, kicker, style.exclusionClause];
  if (style.contentSafety) parts.push(style.contentSafety);
  return parts.join(' ');
}

export function provenance(slug, briefs = defaultBriefs, style = defaultStyle) {
  const b = briefs[slug];
  return [
    'model: gpt-image-2',
    'generated_via: codex|openclaw',
    `slug: ${slug}`,
    `anchor: ${style.anchorDir}/${b.anchor}.jpg`,
    `prompt: ${buildPrompt(slug, briefs, style)}`,
  ].join('\n') + '\n';
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv[2];
  if (arg === '--print') {
    const slug = process.argv[3];
    if (!slug) { console.error('usage: node banner/build-prompt.mjs --print <slug>'); process.exit(1); }
    process.stdout.write(buildPrompt(slug));
    process.exit(0);
  }
  if (!arg) { console.error('usage: node banner/build-prompt.mjs <slug>|--all|--print <slug>'); process.exit(1); }
  const slugs = arg === '--all' ? Object.keys(defaultBriefs) : [arg];
  for (const slug of slugs) {
    const sidecar = join(reposRoot, defaultBriefs[slug].target) + '.prompt.txt';
    console.log(`\n=== ${slug} ===\n${buildPrompt(slug)}`);
    writeFileSync(sidecar, provenance(slug));
    console.log(`(provenance -> ${sidecar})`);
  }
}
