import assert from 'node:assert/strict';
import {
  chmodSync,
  copyFileSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const fleetSync = join(here, 'fleet-sync.sh');

function executable(path, contents) {
  writeFileSync(path, contents);
  chmodSync(path, 0o755);
}

function fixture(mode) {
  const root = mkdtempSync(join(tmpdir(), 'fleet-sync-'));
  const kit = join(root, 'fleet-kit');
  const site = join(root, 'alpha-site');
  const stubs = join(root, 'stubs');
  const trace = join(root, 'trace.log');

  mkdirSync(join(kit, 'bin'), { recursive: true });
  mkdirSync(join(kit, 'og'), { recursive: true });
  mkdirSync(join(site, '.git'), { recursive: true });
  if (mode === 'dirty') mkdirSync(join(root, 'clean-site', '.git'), { recursive: true });
  mkdirSync(stubs);
  copyFileSync(fleetSync, join(kit, 'bin', 'fleet-sync.sh'));
  writeFileSync(
    join(kit, 'sites.config.json'),
    JSON.stringify(mode === 'dirty' ? { 'clean-site': {}, 'alpha-site': {} } : { 'alpha-site': {} }),
  );
  writeFileSync(trace, '');
  if (mode === 'dirty') writeFileSync(join(site, 'local.txt'), 'unfinished work\n');

  executable(
    join(stubs, 'node'),
    `#!/usr/bin/env bash
set -u
printf 'node %s\\n' "$*" >>"$TRACE"
case "\${1:-}" in
  -e)
    if [ "$MODE" = dirty ]; then
      echo 'clean-site alpha-site'
    else
      echo alpha-site
    fi
    ;;
  bin/sync-versions.mjs)
    printf 'generated\\n' >../alpha-site/generated.txt
    printf '{"summary":[]}\\n'
    ;;
  og/render.mjs)
    printf 'card\\n' >../alpha-site/og-card.png
    ;;
esac
`,
  );

  executable(
    join(stubs, 'git'),
    `#!/usr/bin/env bash
set -u
printf 'git %s\\n' "$*" >>"$TRACE"
repo="$2"
command="$3"
case "$command" in
  status)
    if [ "$MODE" = dirty ] && [ "$repo" = "${site}" ]; then
      echo '?? local.txt'
    elif [ -e "$repo/generated.txt" ] || [ -e "$repo/og-card.png" ]; then
      echo ' M generated.txt'
    fi
    ;;
  commit)
    [ "$MODE" != commit-fail ]
    ;;
  push)
    [ "$MODE" != push-fail ]
    ;;
  rev-parse)
    echo main
    ;;
esac
`,
  );

  executable(
    join(stubs, 'agent-notify'),
    `#!/usr/bin/env bash
printf 'notify %s\\n' "$*" >>"$TRACE"
`,
  );

  const run = () =>
    spawnSync('bash', [join(kit, 'bin', 'fleet-sync.sh')], {
      encoding: 'utf-8',
      env: {
        ...process.env,
        MODE: mode,
        TRACE: trace,
        PATH: `${stubs}:${process.env.PATH}`,
      },
    });

  return {
    root,
    run,
    site,
    trace: () => readFileSync(trace, 'utf-8'),
  };
}

test('dirty checkout stops before generated files can touch any site', () => {
  const f = fixture('dirty');
  try {
    const result = f.run();
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /alpha-site: dirty/);
    assert.doesNotMatch(
      f.trace(),
      /node bin\/sync-versions\.mjs|node og\/render\.mjs|git .* pull|git .* add|git .* commit|git .* push/,
    );
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

for (const mode of ['commit-fail', 'push-fail']) {
  test(`${mode} makes the sync fail without announcing a deployment`, () => {
    const f = fixture(mode);
    try {
      const result = f.run();
      assert.notEqual(result.status, 0);
      assert.match(result.stdout, new RegExp(`alpha-site: .*${mode === 'commit-fail' ? 'COMMIT' : 'PUSH'} FAILED`));
      assert.match(result.stdout, /failed: alpha-site/);
      assert.doesNotMatch(f.trace(), /notify /);
    } finally {
      rmSync(f.root, { recursive: true, force: true });
    }
  });
}
