// Canonical Escoffier Labs fleet registry.
//
// SOURCE OF TRUTH: escoffier-fleet-kit/fleet/fleet.ts
// Synced into each *-site repo as src/lib/fleet.ts by bin/fleet-sync.sh.
// Pairs with fleet/FleetLinks.astro (the shared "More from Escoffier Labs" cross-link
// section). Edit here and re-run fleet-sync; do NOT edit the copy inside a site repo.
//
// Station product pages live on brigade.tools at bare paths (/miseledger, /skillet, ...).
// The hub chalkboard at escoffierlabs.dev links here and to GitHub repos.

export interface FleetTool {
  /** Site repo key, e.g. 'brigade-site'. Used to exclude the current site from its own list. */
  key: string;
  name: string;
  url: string;
  blurb: string;
}

export const FLEET_HUB = { name: 'Escoffier Labs', url: 'https://escoffierlabs.dev' };

// Ordered flagship-first; the component renders all entries except the current site.
export const FLEET: FleetTool[] = [
  {
    key: 'brigade-site',
    name: 'Brigade',
    url: 'https://brigade.tools',
    blurb:
      'One reviewed source of the MCP servers, tools, and memory your AI coding agents share, with a review gate and a receipt for every change.',
  },
  {
    key: 'memory-doctor-site',
    name: 'Memory Doctor',
    url: 'https://brigade.tools/memory-doctor',
    blurb: 'Maintenance CLI for the file-based memory agents share: status, lint, ingest, compact.',
  },
  {
    key: 'skillet-site',
    name: 'Skillet',
    url: 'https://brigade.tools/skillet',
    blurb: 'Production-tested skills for auditing, improving, and shipping repos with AI coding agents.',
  },
  {
    key: 'cloche-site',
    name: 'Cloche',
    url: 'https://brigade.tools/cloche',
    blurb: 'Agent-neutral desktop capture: polished screenshots, stable JSON, optional MCP server.',
  },
  {
    key: 'graphtrail-site',
    name: 'GraphTrail',
    url: 'https://brigade.tools/graphtrail',
    blurb:
      'A local SQLite graph of your code, symbols, imports, and call edges, queryable over CLI or a read-only MCP server.',
  },
  {
    key: 'agentpantry-site',
    name: 'Agent Pantry',
    url: 'https://brigade.tools/agentpantry',
    blurb:
      'Mirror the browser auth and secrets you choose to the machine your agent runs on, sealed end to end.',
  },
  {
    key: 'miseledger-site',
    name: 'MiseLedger',
    url: 'https://brigade.tools/miseledger',
    blurb:
      'A local-first evidence graph over agent history, with session, file, git, and chat crawlers built in: full-text search, Markdown export, evidence bundles.',
  },
  {
    key: 'bootstrap-doctor-site',
    name: 'Bootstrap Doctor',
    url: 'https://brigade.tools/bootstrap-doctor',
    blurb: 'Audit oversize agent bootstrap files and trim them into reference cards.',
  },
  {
    key: 'agent-notify-site',
    name: 'Agent Notify',
    url: 'https://brigade.tools/agent-notify',
    blurb: 'Privacy-first push notifications from coding agents to Discord, Telegram, and Signal.',
  },
  {
    key: 'mise-en-scene-site',
    name: 'Mise en Scene',
    url: 'https://brigade.tools/mise-en-scene',
    blurb: 'Turn repos, specs, and incident reports into interactive HTML/SVG explainers.',
  },
];

/** All fleet tools except the current site, flagship-first. */
export function fleetOthers(currentKey: string): FleetTool[] {
  return FLEET.filter((t) => t.key !== currentKey);
}
