// Canonical SEO contract for the Escoffier Labs site fleet.
//
// SOURCE OF TRUTH: escoffier-fleet-kit/seo/seo.ts
// This file is COPIED into each *-site repo (src/lib/seo.ts) by bin/fleet-sync.sh,
// the same way og/render.mjs copies the shared OG card. Do NOT edit the copy inside
// a site repo: edit it here and re-run fleet-sync so every site stays in lockstep.
//
// Pairs with seo/Seo.astro (the shared <head> component). Together they are the
// one place fleet-wide SEO lives, so the 13 site heads stop drifting.
//
// Fleet decisions baked in (2026-06): twitter handle @solomonneas, trailingSlash:'never'
// (canonical strips the trailing slash), OG cards render at 2400x1260, theme colors from
// DESIGN.md. Free, MIT/CC tools, AI-agent-developer audience.

export const FLEET = {
  author: 'Solomon Neas',
  twitter: '@solomonneas',
  hub: 'https://escoffierlabs.dev',
  org: {
    name: 'Escoffier Labs',
    url: 'https://escoffierlabs.dev',
    logo: 'https://escoffierlabs.dev/og-card.png',
    sameAs: ['https://github.com/escoffier-labs'],
  },
  // Every fleet OG card renders at this size (see escoffier-fleet-kit/og/render.mjs).
  ogImage: { width: 2400, height: 1260, type: 'image/png' },
  // From DESIGN.md (dark-ledger kitchen).
  themeColor: { dark: '#0d1014', light: '#f5f2ea' },
} as const;

export interface SeoProps {
  /** Brand name for this site, e.g. "Cloche". */
  siteName: string;
  /** Full <title> text, already composed (use composeTitle). */
  title: string;
  /** 140-160 char meta description, unique per page. */
  description: string;
  /** Path or absolute URL to the social card. Defaults to /og-card.png. */
  ogImage?: string;
  ogType?: 'website' | 'article';
  /** ISO date strings; emit article:published_time / article:modified_time. */
  publishedDate?: string;
  modifiedDate?: string;
  tags?: string[];
  keywords?: string[];
  /** One JSON-LD node or an array (rendered as separate <script> blocks). */
  jsonLd?: object | object[];
  /** Force noindex (dev/preview are auto-noindexed regardless). */
  noindex?: boolean;
  /** GEO lever: link to a plain-markdown alternate of the page. */
  markdownAlt?: string;
}

/**
 * trailingSlash:'never' canonical. Robust to either Astro build.format:
 * strips /index.html, a trailing .html, and any trailing slash, keeping root as '/'.
 */
export function canonicalFor(siteUrl: string, pathname: string): string {
  const path =
    pathname
      .replace(/\/index\.html$/, '/')
      .replace(/\.html$/, '')
      .replace(/\/+$/, '') || '/';
  return new URL(path, siteUrl.replace(/\/+$/, '')).toString();
}

export function absoluteImage(siteUrl: string, ogImage = '/og-card.png'): string {
  return ogImage.startsWith('http') ? ogImage : new URL(ogImage, siteUrl).toString();
}

/** "Page Title - Site Tagline" style, or just the seoTitle for the home page. */
export function composeTitle(pageTitle: string | undefined, seoTitle: string): string {
  if (!pageTitle || pageTitle === seoTitle) return seoTitle;
  return `${pageTitle} - ${seoTitle}`;
}

// ---- JSON-LD builders (schema.org). Keep one Organization @id across the fleet. ----

export function organizationLd() {
  return {
    '@type': 'Organization',
    '@id': `${FLEET.org.url}/#organization`,
    name: FLEET.org.name,
    url: FLEET.org.url,
    logo: FLEET.org.logo,
    sameAs: FLEET.org.sameAs,
  };
}

export function websiteLd(siteName: string, siteUrl: string) {
  return {
    '@type': 'WebSite',
    '@id': `${siteUrl.replace(/\/+$/, '')}/#website`,
    name: siteName,
    url: siteUrl.replace(/\/+$/, ''),
    publisher: { '@id': `${FLEET.org.url}/#organization` },
  };
}

export function softwareApplicationLd(opts: {
  name: string;
  siteUrl: string;
  description: string;
  image: string;
  codeRepository?: string;
  softwareVersion?: string;
  license?: string;
}) {
  return {
    '@type': 'SoftwareApplication',
    name: opts.name,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Linux, macOS, Windows',
    description: opts.description,
    url: opts.siteUrl.replace(/\/+$/, ''),
    image: opts.image,
    ...(opts.codeRepository ? { codeRepository: opts.codeRepository } : {}),
    ...(opts.softwareVersion ? { softwareVersion: opts.softwareVersion } : {}),
    ...(opts.license ? { license: opts.license } : {}),
    publisher: { '@id': `${FLEET.org.url}/#organization` },
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };
}

export function breadcrumbLd(items: { name: string; url: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

/** Wrap nodes in a single @graph document (preferred for multi-node pages). */
export function graph(nodes: object[]) {
  return { '@context': 'https://schema.org', '@graph': nodes };
}
