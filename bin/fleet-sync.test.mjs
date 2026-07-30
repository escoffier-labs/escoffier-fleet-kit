import assert from 'node:assert/strict';
import {
  chmodSync,
  copyFileSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const fleetSync = join(here, 'fleet-sync.sh');
const isWin = process.platform === 'win32';

/** Convert a Windows path to a WSL /mnt/<drive>/... path. */
function toWslPath(p) {
  if (!p) return p;
  const normalized = String(p).replace(/\\/g, '/');
  const m = normalized.match(/^([A-Za-z]):(.*)$/);
  if (m) return `/mnt/${m[1].toLowerCase()}${m[2]}`;
  return normalized;
}

/** Path as seen inside the bash that runs fleet-sync. */
function bashPath(p) {
  return isWin ? toWslPath(p) : p;
}

function executable(path, contents) {
  writeFileSync(path, contents.replace(/\r\n/g, '\n'));
  chmodSync(path, 0o755);
}

function fixture(mode) {
  const root = mkdtempSync(join(tmpdir(), 'fleet-sync-'));
  const kit = join(root, 'fleet-kit');
  const site = join(root, 'alpha-site');
  const stubs = join(root, 'stubs');
  const trace = join(root, 'trace.log');
  const control = join(root, 'control');

  mkdirSync(join(kit, 'bin'), { recursive: true });
  mkdirSync(join(kit, 'og'), { recursive: true });
  mkdirSync(join(site, '.git'), { recursive: true });
  if (mode === 'dirty') mkdirSync(join(root, 'clean-site', '.git'), { recursive: true });
  mkdirSync(stubs);
  mkdirSync(control);
  copyFileSync(fleetSync, join(kit, 'bin', 'fleet-sync.sh'));
  writeFileSync(
    join(kit, 'sites.config.json'),
    JSON.stringify(mode === 'dirty' ? { 'clean-site': {}, 'alpha-site': {} } : { 'alpha-site': {} }),
  );
  writeFileSync(trace, '');
  if (mode === 'dirty') writeFileSync(join(site, 'local.txt'), 'unfinished work\n');

  // Control flags for multi-run scenarios (paths for bash).
  const siteBash = bashPath(site);
  const controlBash = bashPath(control);
  const blockPush = join(control, 'block-push');
  if (mode === 'push-fail' || mode === 'push-retry') {
    writeFileSync(blockPush, '1');
  }

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
  bin/sync-versions.mjs|*/bin/sync-versions.mjs)
    # Keep tree clean for ahead-check failure modes so publish hits commits_ahead.
    if [ "$MODE" != ahead-fail ] && [ "$MODE" != rev-list-fail ]; then
      printf 'generated\\n' >"${siteBash}/generated.txt"
    fi
    printf '{"summary":[]}\\n'
    ;;
  og/render.mjs|*/og/render.mjs)
    if [ "$MODE" != ahead-fail ] && [ "$MODE" != rev-list-fail ]; then
      printf 'card\\n' >"${siteBash}/og-card.png"
    fi
    ;;
  */content-sync.mjs|bin/content-sync.mjs)
    :
    ;;
esac
`,
  );

  executable(
    join(stubs, 'git'),
    `#!/usr/bin/env bash
set -u
printf 'git %s\\n' "$*" >>"$TRACE"
# git -C <repo> <command> ...
repo="\${2:-}"
command="\${3:-}"
case "$command" in
  status)
    if [ "$MODE" = status-fail ]; then
      echo 'fatal: status failed' >&2
      exit 1
    fi
    if [ "$MODE" = dirty ] && [ "$repo" = "${siteBash}" ]; then
      echo '?? local.txt'
      exit 0
    fi
    # Clean working tree once a commit is unpublished (post-commit, pre-push).
    if [ -f "$repo/.unpublished" ]; then
      exit 0
    fi
    if [ -e "$repo/generated.txt" ] || [ -e "$repo/og-card.png" ]; then
      echo ' M generated.txt'
    fi
    exit 0
    ;;
  pull)
    if [ "$MODE" = pull-fail ] || [ "$MODE" = no-upstream ]; then
      echo 'fatal: could not fast-forward / no tracking information' >&2
      exit 1
    fi
    # Script must use tracked upstream: git pull --ff-only --quiet
    # Reject guessed origin/main or origin/master fallbacks.
    if printf '%s' "$*" | grep -qE 'pull --ff-only --quiet origin (main|master)( |$)'; then
      echo 'fatal: must not guess origin/main or origin/master' >&2
      exit 1
    fi
    exit 0
    ;;
  rev-parse)
    # git -C repo rev-parse --abbrev-ref HEAD|@{u}
    # git -C repo rev-parse --verify origin/main
    sub="\${4:-}"
    arg="\${5:-}"
    if [ "$sub" = "--abbrev-ref" ]; then
      if [ "$arg" = "HEAD" ]; then
        if [ "$MODE" = detached ]; then
          echo HEAD
        else
          echo main
        fi
        exit 0
      fi
      if [ "$arg" = "@{u}" ] || [ "$arg" = '@{u}' ]; then
        if [ "$MODE" = ahead-fail ]; then
          echo 'fatal: no upstream configured' >&2
          exit 128
        fi
        if [ -f "$repo/.unpublished" ] || [ "$MODE" = push-retry ] || [ "$MODE" = push-fail ]; then
          echo 'origin/main'
          exit 0
        fi
        # Default clean path: tracked upstream is configured.
        echo 'origin/main'
        exit 0
      fi
    fi
    if [ "$sub" = "--verify" ]; then
      if [ "$MODE" = ahead-fail ]; then
        echo 'fatal: Needed a single revision' >&2
        exit 1
      fi
      exit 0
    fi
    echo main
    exit 0
    ;;
  rev-list)
    # git -C repo rev-list --count <range>
    if [ "$MODE" = rev-list-fail ]; then
      echo 'fatal: bad revision' >&2
      exit 128
    fi
    if [ -f "$repo/.unpublished" ]; then
      echo 1
    else
      echo 0
    fi
    exit 0
    ;;
  add)
    exit 0
    ;;
  commit)
    if [ "$MODE" = commit-fail ]; then
      exit 1
    fi
    touch "$repo/.unpublished"
    exit 0
    ;;
  push)
    if [ -f "${controlBash}/block-push" ]; then
      exit 1
    fi
    rm -f "$repo/.unpublished"
    exit 0
    ;;
  *)
    exit 0
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

  const ensureExec = () => {
    if (!isWin) return;
    // NTFS files created from Windows lack +x inside WSL; force it.
    spawnSync('wsl', ['chmod', '-R', 'a+x', toWslPath(stubs)], { encoding: 'utf-8' });
    spawnSync('wsl', ['chmod', 'a+x', toWslPath(join(kit, 'bin', 'fleet-sync.sh'))], {
      encoding: 'utf-8',
    });
  };

  const run = (opts = {}) => {
    if (opts.allowPush) {
      if (existsSync(blockPush)) rmSync(blockPush);
    }
    if (opts.blockPush) {
      writeFileSync(blockPush, '1');
    }
    ensureExec();

    const script = join(kit, 'bin', 'fleet-sync.sh');
    const modeEnv = opts.mode ?? mode;

    if (isWin) {
      const wslScript = toWslPath(script);
      const wslStubs = toWslPath(stubs);
      const wslTrace = toWslPath(trace);
      // Linux PATH separator inside WSL; stubs first so fake git/node win.
      const wslPath = `${wslStubs}:/usr/bin:/bin`;
      const cmd = [
        `export MODE=${shellQuote(modeEnv)}`,
        `export TRACE=${shellQuote(wslTrace)}`,
        `export PATH=${shellQuote(wslPath)}`,
        `exec bash ${shellQuote(wslScript)}`,
      ].join('; ');
      return spawnSync('wsl', ['bash', '-lc', cmd], { encoding: 'utf-8' });
    }

    return spawnSync('bash', [script], {
      encoding: 'utf-8',
      env: {
        ...process.env,
        MODE: modeEnv,
        TRACE: trace,
        PATH: `${stubs}${delimiter}${process.env.PATH || ''}`,
      },
    });
  };

  return {
    root,
    run,
    site,
    control,
    blockPush,
    trace: () => readFileSync(trace, 'utf-8'),
  };
}

function shellQuote(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
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
      assert.match(
        result.stdout,
        new RegExp(`alpha-site: .*${mode === 'commit-fail' ? 'COMMIT' : 'PUSH'} FAILED`),
      );
      assert.match(result.stdout, /failed: alpha-site/);
      assert.doesNotMatch(f.trace(), /notify /);
    } finally {
      rmSync(f.root, { recursive: true, force: true });
    }
  });
}

test('failed upstream pull fails the run and reports the site (not a silent no-op)', () => {
  const f = fixture('pull-fail');
  try {
    const result = f.run();
    assert.notEqual(result.status, 0, `stdout=${result.stdout}\nstderr=${result.stderr}`);
    assert.match(result.stdout, /alpha-site:.*PULL FAILED|PULL FAILED.*alpha-site|alpha-site: PULL FAILED/);
    assert.doesNotMatch(
      f.trace(),
      /node bin\/sync-versions\.mjs|node og\/render\.mjs|git .* commit|git .* push/,
    );
    assert.doesNotMatch(f.trace(), /notify /);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

test('pull uses tracked upstream only (no origin/main or origin/master guess)', () => {
  const f = fixture('clean');
  try {
    const result = f.run();
    assert.equal(result.status, 0, `stdout=${result.stdout}\nstderr=${result.stderr}`);
    const trace = f.trace();
    assert.match(trace, /git -C .+ pull --ff-only --quiet(?! origin)/);
    assert.doesNotMatch(trace, /pull --ff-only --quiet origin (main|master)/);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

test('missing tracked upstream is a site pull failure', () => {
  const f = fixture('no-upstream');
  try {
    const result = f.run();
    assert.notEqual(result.status, 0, `stdout=${result.stdout}\nstderr=${result.stderr}`);
    assert.match(result.stdout, /alpha-site: PULL FAILED|PULL FAILED/);
    assert.doesNotMatch(
      f.trace(),
      /node bin\/sync-versions\.mjs|node og\/render\.mjs|git .* commit|git .* push/,
    );
    assert.doesNotMatch(f.trace(), /notify /);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

test('upstream resolution failure is not treated as ahead=0 success', () => {
  const f = fixture('ahead-fail');
  try {
    const result = f.run();
    assert.notEqual(result.status, 0, `stdout=${result.stdout}\nstderr=${result.stderr}`);
    assert.match(result.stdout, /alpha-site: AHEAD CHECK FAILED/);
    assert.match(result.stdout, /failed:.*alpha-site/i);
    // Publication state uses only @{u}; never fall back to origin/<branch>.
    assert.doesNotMatch(f.trace(), /rev-parse --verify origin\//);
    assert.doesNotMatch(f.trace(), /notify /);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

test('rev-list failure is not treated as ahead=0 success', () => {
  const f = fixture('rev-list-fail');
  try {
    const result = f.run();
    assert.notEqual(result.status, 0, `stdout=${result.stdout}\nstderr=${result.stderr}`);
    assert.match(result.stdout, /alpha-site:.*(AHEAD|STATUS|FAILED)|failed:.*alpha-site/i);
    assert.match(result.stdout, /failed:/i);
    assert.doesNotMatch(f.trace(), /notify /);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

test('detached HEAD is rejected before generation or commit', () => {
  const f = fixture('detached');
  try {
    const result = f.run();
    assert.notEqual(result.status, 0, `stdout=${result.stdout}\nstderr=${result.stderr}`);
    assert.match(result.stdout, /detached/i);
    assert.doesNotMatch(
      f.trace(),
      /node bin\/sync-versions\.mjs|node og\/render\.mjs|git .* pull|git .* add|git .* commit|git .* push/,
    );
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

test('failed git status --porcelain is an error, not treated as clean', () => {
  const f = fixture('status-fail');
  try {
    const result = f.run();
    assert.notEqual(result.status, 0, `stdout=${result.stdout}\nstderr=${result.stderr}`);
    assert.match(result.stdout, /status|STATUS|failed/i);
    assert.doesNotMatch(
      f.trace(),
      /node bin\/sync-versions\.mjs|node og\/render\.mjs|git .* pull|git .* commit|git .* push/,
    );
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

test('failed push leaves unpublished commits; later run retries push and never reports success while ahead', () => {
  const f = fixture('push-retry');
  try {
    // Run 1: commit succeeds, push blocked -> fail, no notify
    const first = f.run();
    assert.notEqual(first.status, 0, `run1 stdout=${first.stdout}\nstderr=${first.stderr}`);
    assert.match(first.stdout, /PUSH FAILED/);
    assert.match(first.stdout, /failed: alpha-site/);
    assert.doesNotMatch(f.trace(), /notify /);
    assert.ok(existsSync(join(f.site, '.unpublished')), 'commit should leave unpublished marker');

    // Run 2 still blocked: clean tree but ahead of upstream -> must still fail
    const stillBlocked = f.run({ blockPush: true });
    assert.notEqual(
      stillBlocked.status,
      0,
      `run2-blocked stdout=${stillBlocked.stdout}\nstderr=${stillBlocked.stderr}`,
    );
    assert.match(stillBlocked.stdout, /PUSH FAILED|unpublished|ahead|PUSHED/i);
    // Must not claim overall success while unpublished
    assert.notEqual(stillBlocked.status, 0);
    assert.doesNotMatch(f.trace(), /notify /);
    assert.ok(existsSync(join(f.site, '.unpublished')), 'still unpublished while push blocked');

    // Run 3: push allowed -> should publish the pending commit
    const third = f.run({ allowPush: true });
    assert.equal(third.status, 0, `run3 stdout=${third.stdout}\nstderr=${third.stderr}`);
    assert.match(third.stdout, /PUSHED|pushed/i);
    assert.ok(!existsSync(join(f.site, '.unpublished')), 'unpublished marker cleared after push');
    assert.match(f.trace(), /notify /);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});
