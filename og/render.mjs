// Render OG cards from one shared template, no web server in the loop.
// Usage: node og/render.mjs [siteSlug]   (omit slug to render all)
import { chromium } from 'playwright-core';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repos = join(here, '..', '..');

// Resolve a Chromium binary: prefer a Playwright cache build, fall back to system Chrome.
import { readdirSync } from 'node:fs';
function chromiumPath() {
  const cache = join(process.env.HOME, '.cache', 'ms-playwright');
  if (existsSync(cache)) {
    for (const d of readdirSync(cache)) {
      if (!d.startsWith('chromium-')) continue;
      for (const sub of ['chrome-linux64/chrome', 'chrome-linux/chrome']) {
        const p = join(cache, d, sub);
        if (existsSync(p)) return p;
      }
    }
  }
  for (const p of ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']) {
    if (existsSync(p)) return p;
  }
  throw new Error('No Chromium binary found (Playwright cache or system Chrome)');
}

const template = readFileSync(join(here, 'template.html'), 'utf-8');
const sites = JSON.parse(readFileSync(join(here, 'sites.json'), 'utf-8'));
const only = process.argv[2];

const browser = await chromium.launch({ executablePath: chromiumPath() });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });

const written = [];
for (const [slug, data] of Object.entries(sites)) {
  if (only && slug !== only) continue;
  const out = join(repos, slug, 'public', 'og-card.png');
  if (!existsSync(join(repos, slug))) {
    console.warn('skip (no repo):', slug);
    continue;
  }
  await page.setContent(template, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate((d) => window.renderOG(d), data);
  await page.waitForTimeout(350);
  await page.screenshot({ path: out });
  written.push(slug);
  console.log('wrote', out);
}

await browser.close();
console.log(`\n${written.length} card(s) rendered.`);
