// Academy data sync: copy the deep-dive source of record from opsdeck into
// escoffier-site so the public Astro academy renders the exact same content the
// opsdeck dashboard authors. This replaces the old manual `cp` of *generated
// HTML* with an automated copy of *source data*: opsdeck stays the single place
// the dives are authored and type-checked; escoffier-site holds a committed
// mirror that Vercel builds.
//
// The two repos mirror the same `src/` layout, so the data files' relative
// import (`../../academy/types`) resolves unchanged on both sides and no path
// rewriting is needed. Idempotent; run whenever the academy data changes.
//
//   node bin/academy-sync.mjs          # write the mirror into escoffier-site
//   node bin/academy-sync.mjs --check  # exit 1 if the mirror has drifted (CI)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Files copied verbatim, keyed by their path under each repo's `src/`.
export const ACADEMY_FILES = [
  'academy/types.ts',
  'data/academy/index.ts',
  'data/academy/brigade.ts',
  'data/academy/escoffier-fleet.ts',
  'data/academy/skillet.ts',
  'data/academy/mise-en-scene.ts',
];

function pkgName(dir) {
  const pkg = join(dir, 'package.json');
  if (!existsSync(pkg)) return null;
  try {
    return JSON.parse(readFileSync(pkg, 'utf-8')).name ?? null;
  } catch {
    return null;
  }
}

/**
 * Sync the academy source files from `src` (opsdeck) into `dst` (escoffier-site).
 * @param {{src: string, dst: string, check?: boolean, log?: (m: string) => void}} opts
 * @returns {{synced: string[], drifted: string[]}}
 */
export function syncAcademy({ src, dst, check = false, log = () => {} }) {
  // Refuse to write anywhere that is not escoffier-site: this script fabricates
  // files, so a wrong `dst` would scatter data across the tree.
  const name = pkgName(dst);
  if (name !== 'escoffier-site') {
    throw new Error(`refusing to sync: ${dst} is not escoffier-site (package name: ${name ?? 'none'})`);
  }

  const synced = [];
  const drifted = [];
  for (const rel of ACADEMY_FILES) {
    const from = join(src, 'src', rel);
    const to = join(dst, 'src', rel);
    if (!existsSync(from)) throw new Error(`missing academy source: ${from}`);
    const content = readFileSync(from, 'utf-8');
    const current = existsSync(to) ? readFileSync(to, 'utf-8') : null;
    if (current === content) continue;
    if (check) {
      drifted.push(rel);
      log(`DRIFT ${rel}`);
      continue;
    }
    mkdirSync(dirname(to), { recursive: true });
    writeFileSync(to, content);
    synced.push(rel);
    log(`synced ${rel}`);
  }
  return { synced, drifted };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const here = dirname(fileURLToPath(import.meta.url));
  const repos = join(here, '..', '..');
  const srcArg = process.argv.find((a) => a.startsWith('--src='));
  const dstArg = process.argv.find((a) => a.startsWith('--dst='));
  const src = srcArg ? srcArg.slice(6) : join(repos, 'opsdeck');
  const dst = dstArg ? dstArg.slice(6) : join(repos, 'escoffier-site');
  const check = process.argv.includes('--check');

  if (pkgName(src) == null) {
    console.error(`opsdeck not found at ${src}`);
    process.exit(2);
  }

  try {
    const { synced, drifted } = syncAcademy({ src, dst, check, log: (m) => console.log(m) });
    if (check) {
      if (drifted.length) {
        console.error(`academy-sync: ${drifted.length} file(s) drifted; run \`node bin/academy-sync.mjs\` and commit escoffier-site`);
        process.exit(1);
      }
      console.log('academy-sync: escoffier-site is in sync with opsdeck');
    } else {
      console.log(synced.length ? `academy-sync: ${synced.length} file(s) updated` : 'academy-sync: already in sync');
    }
  } catch (err) {
    console.error(`academy-sync: ${err.message}`);
    process.exit(2);
  }
}
