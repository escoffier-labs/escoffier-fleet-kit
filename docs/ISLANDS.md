# Fleet islands: jal-co/ui React components in an Astro site

How to drop Justin Levine's jal-co/ui components (github.com/jal-co/ui, the
shieldcn author) into any Escoffier fleet Astro site as React islands, themed to
the ledger palette with no per-component styling. Proven on brigade.tools/blog
(a live `CommitGraph` release timeline and a release/CI badge strip) and on
solomonneas.dev.

Justin's components stay upstream-managed: you install them per site with the
shadcn CLI. The kit only ships the glue that makes them fit Astro (the token
bridge, the build-time GitHub fetchers, the static-badge composition, the
shieldcn chart wrapper).

## What the kit ships (`fleet/islands/`)

- `shadcn-alias.css` - the shadcn -> ledger token bridge (`:root` aliases +
  `@theme inline`). Maps `--color-background`, `--color-primary`, `--color-border`,
  etc. onto the shared fleet tokens, so islands theme in light and dark for free.
- `github-data.ts` - build-time GitHub fetchers (`fetchRecentCommits`,
  `fetchLatestRelease`, `fetchCIStatus`) with in-module caches. Fails soft to
  null / `[]`. Reads `GITHUB_TOKEN` if set.
- `JalcoProjectBadgesStatic.tsx` - composes jal-co's release + CI badges,
  rendered static (no hydration).
- `ShieldcnChart.astro` - dark/light `<img>` swap for shieldcn charts.

## Prerequisites (once per site)

The site must be Astro + Tailwind 4 with the React integration and shadcn set up:

- `@astrojs/react` in `astro.config.mjs` `integrations: [react()]`.
- Tailwind 4 via `@tailwindcss/vite`.
- `components.json` (run `npx shadcn@latest init` if missing; style new-york,
  tsx, cssVariables true).
- `tsconfig.json` has `"paths": { "@/*": ["./src/*"] }`, `"jsx": "react-jsx"`,
  `"jsxImportSource": "react"`.
- `src/lib/utils.ts` (the shadcn `cn` helper; `npx shadcn add button` pulls it).

## Adopt (one command)

```bash
escoffier-fleet-kit/bin/adopt-islands.sh <site-dir-name>
```

That copies the four glue files into the site (`github-data.ts` -> `src/lib/`,
the components -> `src/components/`, `shadcn-alias.css` -> `src/styles/`) and
prints the remaining manual steps below.

## Wire it up

1. **Token bridge.** Paste the contents of `src/styles/shadcn-alias.css` into
   the site's `src/styles/global.css`, below the `[data-theme]` token blocks
   (or `@import './shadcn-alias.css';` if you prefer to keep it separate).

2. **Registry.** Add to `components.json`:
   ```json
   "registries": { "@jalco": "https://ui.justinlevine.me/r/{name}.json" }
   ```

3. **Install the components you want:**
   ```bash
   npx shadcn@latest add @jalco/commit-graph @jalco/release-badge @jalco/ci-badge --yes
   ```

4. **Mount them.** Interactive components hydrate, display-only ones do not:
   ```astro
   ---
   import { CommitGraph } from '../components/commit-graph';
   import { JalcoProjectBadgesStatic } from '../components/JalcoProjectBadgesStatic';
   import { fetchRecentCommits, fetchLatestRelease, fetchCIStatus } from '../lib/github-data';

   const commits = await fetchRecentCommits('escoffier-labs', 'brigade', 8);
   const release = await fetchLatestRelease('escoffier-labs', 'brigade');
   const ci = await fetchCIStatus('escoffier-labs', 'brigade');
   ---
   <!-- interactive (radix Popover): needs a client directive -->
   <CommitGraph client:idle commits={commits} className="commit-graph" />

   <!-- display only: render static, no hydration -->
   <JalcoProjectBadgesStatic release={release} ci={ci} />
   ```

## Gotchas (learned the hard way on brigade-site)

- **`@jalco/activity-graph` overwrites `src/lib/github.ts`** and drops
  `fetchLatestRelease`, which `release-badge` imports at module top, so the build
  fails. Fix: make `src/lib/github.ts` a re-export: `export * from './github-data';`.
  Then one lib serves the jal-co components and your pages.
- **jal-co `CodeBlock` does not work in Astro.** It is an `async` React server
  component (`await highlightCode(...)`); Astro's React renderer cannot mount
  async components. Use Astro's built-in Shiki for markdown and hand-authored
  `<pre>`, plus a copy button. solomonneas.dev never used jal-co CodeBlock either.
- **GitHub fetch runs at build.** Unauthenticated is 60 req/hr per IP. Set
  `GITHUB_TOKEN` in the site's Vercel build env if it bites. Fails soft either way.
- **Only interactive components need a client directive.** `CommitGraph` uses a
  radix Popover, so `client:idle`. Badges are pure display, so render them static.

## Reference implementation

brigade-site: `src/pages/blog/index.astro` (CommitGraph), `src/layouts/BlogLayout.astro`
(badges), `src/lib/github.ts` (the re-export fix), `src/styles/global.css` (the
alias layer in place).
