# Fleet SEO contract

One canonical `<head>` for every Escoffier Labs site, so the 13 site heads stop
drifting and every future repo starts SEO-correct. Pairs with the OG card pipeline
in `../og/` and the version sync in `../bin/`.

## Files (source of truth)

| File | Copied into each site as | Role |
|------|--------------------------|------|
| `seo.ts` | `src/lib/seo.ts` | Fleet constants + JSON-LD builders + canonical/title helpers |
| `Seo.astro` | `src/components/Seo.astro` | The shared `<head>` (title, meta, OG, Twitter, JSON-LD, theme-color) |
| `robots.txt.tmpl` | `public/robots.txt` (per-site host) | Allow-all + correct sitemap line |

Do **not** edit the copies inside a site repo. Edit here and run `bin/fleet-sync.sh`,
which overwrites the copy in every site that has already adopted it (i.e. any site
with a `src/components/Seo.astro`). A site opts in once during rollout; after that it
stays in lockstep automatically.

## Fleet decisions baked in (2026-06)

- **Twitter/X:** `@solomonneas` (site + creator).
- **trailingSlash:** `'never'`. `canonicalFor()` strips the trailing slash (and any
  `index.html`/`.html`), so canonical, og:url and sitemap all agree on the no-slash form.
  Set `trailingSlash: 'never'` in each site's `astro.config.mjs`; leave `build.format`
  at the default `directory` (Vercel clean-URLs serve it; `format:'file'` breaks
  `Astro.url.pathname`).
- **OG cards:** 2400x1260 (matches `og/render.mjs`); dimensions emitted so cards render
  instantly on first share.
- **Theme color:** dark `#0d1014` / light `#f5f2ea` (DESIGN.md).
- **Dev/preview auto-noindex** so Vercel preview deploys never get indexed.
- **GEO stance:** llms.txt + schema show near-zero AI-citation lift (Ahrefs 2026), so we
  ship them cheaply and spend real effort on fresh/chunked content + `markdownAlt`.

## Adopt in a site (rollout or new repo)

1. `astro.config.mjs`: set `site: 'https://<your-domain>'` and `trailingSlash: 'never'`.
2. Copy `seo.ts` -> `src/lib/seo.ts` and `Seo.astro` -> `src/components/Seo.astro`
   (or just run `bin/fleet-sync.sh` once the files exist).
3. In `BaseLayout.astro`, keep `<meta charset>`, viewport, favicon, analytics and the
   theme-init script; replace the hand-rolled title/meta/OG/Twitter/JSON-LD block with:

   ```astro
   ---
   import Seo from '../components/Seo.astro';
   import { SITE, EXTERNAL } from '../lib/site.ts';
   import { composeTitle, softwareApplicationLd, organizationLd, absoluteImage, graph } from '../lib/seo.ts';

   const { title: pageTitle, description = SITE.metaDescription ?? SITE.description } = Astro.props;
   const title = composeTitle(pageTitle, SITE.seoTitle);
   const siteUrl = (Astro.site ?? new URL(SITE.url)).toString();
   const jsonLd = graph([
     organizationLd(),
     softwareApplicationLd({
       name: SITE.name, siteUrl, description, image: absoluteImage(siteUrl, SITE.image),
       codeRepository: EXTERNAL.github, softwareVersion: SITE.version, license: EXTERNAL.license,
     }),
   ]);
   ---
   <head>
     <meta charset="utf-8" />
     <meta name="viewport" content="width=device-width, initial-scale=1" />
     <Seo siteName={SITE.name} title={title} description={description} jsonLd={jsonLd} />
     <link rel="icon" href="/favicon.svg" />
     <!-- analytics + theme-init script stay here -->
   </head>
   ```

4. The **hub** (escoffierlabs.dev) uses `graph([organizationLd(), websiteLd(name, url)])`
   instead of `softwareApplicationLd` (it markets the brand, not one app). Docs/article
   pages pass `ogType="article"`, `publishedDate`, `modifiedDate`, and a
   `breadcrumbLd([...])` node.
5. Build and confirm: exactly one of each meta tag, canonical has no trailing slash,
   JSON-LD parses.

The `skillet:seo-fleet` skill automates steps 1-5 and audits any repo against this contract.
