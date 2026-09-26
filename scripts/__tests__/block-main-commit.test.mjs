import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// The "never commit to main" guard has to read the branch of the repo the
// command actually writes to. Reading CLAUDE_PROJECT_DIR instead made every
// agent worktree look like it was on main (false block), while `git -C <path>`
// slipped past the old regex entirely (bypass). Both directions are locked in
// here — this hook is the only thing standing between an agent and main.

const HOOK = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.claude', 'hooks', 'block-main-commit.sh');

let root; // temp dir
let primary; // checkout on main
let worktree; // linked worktree on a feature branch

const git = (cwd, ...args) =>
  execFileSync('git', ['-c', 'commit.gpgsign=false', '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
    cwd,
    stdio: 'pipe',
  });

/** Run the hook exactly as Claude Code does: JSON payload on stdin. */
function runHook(command, cwd, { projectDir = primary } = {}) {
  return spawnSync('bash', [HOOK], {
    input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', cwd, tool_input: { command } }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
    encoding: 'utf8',
  });
}

const allowed = (command, cwd, opts) => runHook(command, cwd, opts).status === 0;
const blocked = (command, cwd, opts) => runHook(command, cwd, opts).status === 2;

before(() => {
  root = mkdtempSync(join(tmpdir(), 'block-main-commit-'));
  primary = join(root, 'primary');
  worktree = join(root, 'wt');
  git(root, 'init', '-b', 'main', primary);
  git(primary, 'commit', '--allow-empty', '-m', 'root');
  git(primary, 'worktree', 'add', '-b', 'feat/x', worktree);
});

after(() => rmSync(root, { recursive: true, force: true }));

test('a worktree on a feature branch can commit even while the primary checkout is on main', () => {
  assert.equal(git(primary, 'branch', '--show-current').toString().trim(), 'main');
  assert.ok(allowed('git commit -m "wip"', worktree), 'CLAUDE_PROJECT_DIR must not decide the branch');
});

test('committing from a checkout that is on main is blocked', () => {
  const result = runHook('git commit -m "wip"', primary);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /BLOCKED: never commit to 'main'/);
});

test("`git -C <main checkout>` from a worktree is blocked — the old regex's bypass", () => {
  assert.ok(blocked(`git -C ${primary} commit -m "wip"`, worktree));
});

test('`cd <main checkout> && git commit` is blocked', () => {
  assert.ok(blocked(`cd ${primary} && git commit -m "wip"`, worktree));
  assert.ok(blocked('cd ../primary && git commit -m "wip"', worktree), 'relative cd is followed too');
});

test('`git -C <feature worktree>` from the main checkout is allowed', () => {
  assert.ok(allowed(`git -C ${worktree} commit -m "wip"`, primary));
});

test('a commit on a later line of a multi-line command is still seen', () => {
  assert.ok(blocked('git status\ngit commit -m "wip"', primary));
});

test('global flags before the subcommand do not hide it', () => {
  assert.ok(blocked('git --no-pager commit -m "wip"', primary));
  assert.ok(blocked('git -c core.editor=true commit -m "wip"', primary));
});

test('`commit` as a word inside an argument is not a commit', () => {
  assert.ok(allowed('echo "git commit -m x"', primary));
  assert.ok(allowed('git log --grep "git commit"', primary));
  assert.ok(allowed('git commit-graph write', primary), 'commit-graph is a different subcommand');
});

test('pushing to main is blocked from any branch', () => {
  const result = runHook('git push origin main', worktree);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /never push directly to 'main'/);
  assert.ok(blocked('git push --force origin HEAD:main', worktree));
  assert.ok(blocked('git push origin :main', worktree), 'deleting main counts');
});

test('a bare push is blocked only when the branch it would push is main', () => {
  assert.ok(blocked('git push', primary), 'bare push on main pushes main');
  assert.ok(blocked('git push -u origin', primary));
  assert.ok(allowed('git push', worktree));
  assert.ok(allowed('git push -u origin feat/x', worktree));
  assert.ok(allowed('git push origin HEAD', worktree));
});

test('an unresolvable target falls back to the starting directory rather than failing open', () => {
  assert.ok(blocked('git -C $MISSING_VAR commit -m "wip"', primary));
  assert.ok(blocked(`git -C ${join(root, 'nope')} commit -m "wip"`, primary));
});

test('non-git and unparseable commands pass through', () => {
  assert.ok(allowed('pnpm test', primary));
  assert.ok(allowed('echo "unbalanced', primary));
  assert.ok(allowed('git status', primary));
});
