// Insert (or refresh) PROVENANCE.md entries for the given slugs, kept alphabetical.
// Usage: node banner/insert-provenance.mjs <slug> [<slug> ...]
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildPrompt } from './build-prompt.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const P = join(here, 'PROVENANCE.md');
const slugs = process.argv.slice(2);
if (!slugs.length) { console.error('usage: node banner/insert-provenance.mjs <slug> [<slug> ...]'); process.exit(1); }

let txt = readFileSync(P, 'utf-8');
const head = txt.slice(0, txt.indexOf('\n## '));
const body = txt.slice(txt.indexOf('\n## ') + 1);
const map = new Map();
for (const block of body.split(/\n(?=## )/).map(s => s.replace(/\n+$/, ''))) {
  map.set(block.match(/^## (.+)/)[1].trim(), block);
}
for (const s of slugs) map.set(s, `## ${s}\n\n${buildPrompt(s)}`);
const out = head + '\n' + [...map.keys()].sort().map(n => map.get(n)).join('\n\n') + '\n';
writeFileSync(P, out);
console.log(`PROVENANCE.md now has ${map.size} sections`);
