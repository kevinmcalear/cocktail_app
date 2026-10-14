import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// The Stop hook runs typecheck, eslint and the design ratchet before Claude
// ends a turn with code changes. It must be cheap when there is nothing new to
// check, block with a reason Claude can act on when a check fails, and never
// wedge a session. The real tools are swapped for fakes in a temp repo: each
// fails while a source file contains its marker, and logs that it ran.

const HOOK = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.claude', 'hooks', 'stop-checks.sh');

let root;
let repo; // has node_modules with the fake tools
let bare; // no node_modules
let log; // one line per check run

const git = (cwd, ...args) =>
  execFileSync('git', ['-c', 'commit.gpgsign=false', '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
    cwd,
    stdio: 'pipe',
  });

const fake = (name, marker) =>
  `#!/bin/sh\necho ${name} >> "$STOP_CHECKS_LOG"\nif grep -rl ${marker} src; then echo "${name}: found ${marker}"; exit 1; fi\n`;

function makeRepo(dir, { withNodeModules }) {
  git(root, 'init', '-b', 'feat/x', dir);
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src', 'a.ts'), 'export const a = 1;\n');
  writeFileSync(join(dir, '.gitignore'), 'node_modules\n');
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ scripts: { 'check:design': 'sh ./design.sh' } }));
  writeFileSync(join(dir, 'design.sh'), fake('check:design', 'DESIGN_ERROR'));
  if (withNodeModules) {
    const bin = join(dir, 'node_modules', '.bin');
    mkdirSync(bin, { recursive: true });
    for (const [name, marker] of [['tsc', 'TYPE_ERROR'], ['eslint', 'LINT_ERROR']]) {
      writeFileSync(join(bin, name), fake(name, marker));
      chmodSync(join(bin, name), 0o755);
    }
  }
  git(dir, 'add', '.');
  git(dir, 'commit', '-m', 'root');
}

/** Run the hook as Claude Code does: JSON payload on stdin. */
function runHook(cwd, { active = false } = {}) {
  return spawnSync('bash', [HOOK], {
    input: JSON.stringify({ hook_event_name: 'Stop', stop_hook_active: active, cwd }),
    env: { ...process.env, STOP_CHECKS_LOG: log, CLAUDE_PROJECT_DIR: root },
    encoding: 'utf8',
  });
}

const runs = () => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').filter(Boolean) : []);
const write = (file, text) => writeFileSync(join(repo, file), text);

before(() => {
  root = mkdtempSync(join(tmpdir(), 'stop-checks-'));
  repo = join(root, 'repo');
  bare = join(root, 'bare');
  log = join(root, 'checks.log');
  makeRepo(repo, { withNodeModules: true });
  makeRepo(bare, { withNodeModules: false });
});

after(() => rmSync(root, { recursive: true, force: true }));

test('no code changes: nothing runs', () => {
  rmSync(log, { force: true });
  let r = runHook(repo);
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
  write('README.md', 'docs only\n');
  r = runHook(repo);
  assert.equal(r.stdout, '');
  assert.deepEqual(runs(), [], 'a docs-only change is not checked');
  rmSync(join(repo, 'README.md'));
});

test('a failing check blocks with the check name and its output', () => {
  rmSync(log, { force: true });
  write('src/a.ts', 'export const a: number = "TYPE_ERROR";\n');
  const r = runHook(join(repo, 'src')); // cwd below the repo root still resolves it
  assert.equal(r.status, 0, 'blocks through JSON, not the exit code');
  const out = JSON.parse(r.stdout);
  assert.equal(out.decision, 'block');
  assert.match(out.reason, /typecheck failed/);
  assert.match(out.reason, /tsc: found TYPE_ERROR/);
  assert.doesNotMatch(out.reason, /eslint failed|check:design failed/);
  assert.deepEqual(runs(), ['tsc', 'eslint', 'check:design'], 'every check runs so all failures come back at once');
});

test('stopping again with the same failing changes is let through instead of looping', () => {
  const r = runHook(repo, { active: true });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});

test('passing changes are fingerprinted and not checked again until they change', () => {
  write('src/a.ts', 'export const a = 2;\n');
  write('src/new.ts', 'export const b = 1;\n'); // untracked files count
  rmSync(log, { force: true });
  assert.equal(runHook(repo).stdout, '');
  assert.deepEqual(runs(), ['tsc', 'eslint', 'check:design']);

  rmSync(log, { force: true });
  assert.equal(runHook(repo).stdout, '');
  assert.deepEqual(runs(), [], 'same fingerprint: skipped');

  write('src/new.ts', 'export const b = "LINT_ERROR";\n');
  const out = JSON.parse(runHook(repo).stdout);
  assert.match(out.reason, /eslint failed/);
  assert.match(out.reason, /src\/new\.ts/, 'eslint is given the changed files');
});

test('exits 0 without checking when node_modules is missing', () => {
  writeFileSync(join(bare, 'src', 'a.ts'), 'export const a: number = "TYPE_ERROR DESIGN_ERROR";\n');
  rmSync(log, { force: true });
  const r = runHook(bare);
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
  assert.deepEqual(runs(), []);
});

test('a bad payload or a cwd outside any repo exits 0 quietly', () => {
  for (const input of ['not json', '', JSON.stringify({ cwd: tmpdir() })]) {
    const r = spawnSync('bash', [HOOK], { input, cwd: root, encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
  }
});
