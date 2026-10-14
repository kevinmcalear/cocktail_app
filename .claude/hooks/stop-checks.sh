#!/usr/bin/env bash
# Stop hook: before Claude ends a turn with uncommitted code changes, run the
# CI checks that most often fail a PR (typecheck, eslint on the changed files,
# the design ratchet). If one fails, Claude is told to keep going and fix it.
#
# The repo is resolved from the payload's `cwd`, NOT from CLAUDE_PROJECT_DIR,
# which points at the primary checkout and would check the wrong tree from an
# agent worktree (see block-main-commit.sh).
#
# Cheap by design:
#   - no changed .ts/.tsx/.js/.mjs files: exit at once;
#   - the same changes already passed, or already failed and were reported
#     (fingerprints under the git dir): skip;
#   - tsc runs with --incremental, its build info kept under the git dir, so a
#     warm run takes a couple of seconds instead of a full check.
#
# Never wedges a session: no node_modules, no node, or any error in this script
# means exit 0 and let Claude stop. A failure is reported as
# {"decision":"block","reason":...} on stdout, still with exit 0.
set -uo pipefail

run() {
  local payload cwd top active
  payload=$(cat)
  command -v node >/dev/null 2>&1 || return 0
  # Line 1: stop_hook_active (Claude is continuing because of a block), line 2: cwd.
  payload=$(printf '%s' "$payload" | node -e '
    let s = "";
    process.stdin.on("data", (d) => (s += d)).on("end", () => {
      const p = JSON.parse(s || "{}");
      process.stdout.write(`${p.stop_hook_active === true}\n${p.cwd || ""}`);
    });') || return 0
  active=${payload%%$'\n'*}
  cwd=${payload#*$'\n'}
  [ -n "$cwd" ] || cwd=$PWD
  top=$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null) || return 0
  cd "$top" || return 0
  [ -d node_modules ] || return 0

  local code_re='\.(ts|tsx|js|mjs)$'
  local changed untracked
  # quotePath off: otherwise a non-ASCII name comes back quoted and escaped.
  changed=$(git -c core.quotePath=false diff --name-only HEAD 2>/dev/null) || return 0
  untracked=$(git -c core.quotePath=false ls-files --others --exclude-standard)
  printf '%s\n%s\n' "$changed" "$untracked" | grep -Eq "$code_re" || return 0

  # Fingerprint: HEAD, the tracked diff, and each untracked file's name and content.
  local fingerprint ok_file blocked_file blocked_fp="" streak=0
  fingerprint=$(
    {
      git rev-parse HEAD
      git diff HEAD --binary
      printf '%s\n' "$untracked" | while IFS= read -r f; do
        [ -f "$f" ] || continue
        printf '\0%s\0' "$f"
        cat -- "$f"
      done
    } | git hash-object --stdin
  ) || return 0
  ok_file=$(git rev-parse --path-format=absolute --git-path claude-stop-ok)
  blocked_file=$(git rev-parse --path-format=absolute --git-path claude-stop-blocked)
  [ "$(cat "$ok_file" 2>/dev/null)" = "$fingerprint" ] && return 0

  # These exact changes already failed and Claude was told: don't run the
  # checks or block again until something changes.
  [ -f "$blocked_file" ] && read -r blocked_fp streak <"$blocked_file"
  [ "$blocked_fp" = "$fingerprint" ] && return 0
  # Sent back three times in a row this turn and still failing (maybe the
  # failure isn't in its diff at all): let it stop rather than loop.
  [ "$active" = true ] || streak=0
  [ "${streak:-0}" -ge 3 ] && return 0

  # Changed files that still exist, for eslint (it reports its own ignores).
  local lint_files=() ratchet=false
  while IFS= read -r f; do
    [ -f "$f" ] && lint_files+=("$f")
  done < <(printf '%s\n%s\n' "$changed" "$untracked" | grep -E "$code_re" | sort -u)
  # The ratchet lints the whole tree (a few seconds), so run it only when a
  # file it covers, or the ratchet itself, changed.
  printf '%s\n%s\n' "$changed" "$untracked" |
    grep -Eq '^((app|components|hooks|lib|store|ctx)/.*\.tsx?|scripts/design-ratchet\..*)$' && ratchet=true

  local out failures=""
  out=$(mktemp) || return 0
  check() {
    local name=$1
    shift
    if ! "$@" >"$out" 2>&1; then
      failures+="== $name failed: $*"$'\n'"$(tail -n 60 "$out")"$'\n\n'
    fi
  }
  check typecheck node_modules/.bin/tsc --noEmit --incremental \
    --tsBuildInfoFile "$(git rev-parse --path-format=absolute --git-path claude-tsc.tsbuildinfo)"
  if [ ${#lint_files[@]} -gt 0 ]; then
    check eslint node_modules/.bin/eslint --no-warn-ignored -- "${lint_files[@]}"
  fi
  [ "$ratchet" = true ] && check check:design npm run --silent check:design
  rm -f "$out"

  if [ -z "$failures" ]; then
    printf '%s\n' "$fingerprint" >"$ok_file"
    rm -f "$blocked_file"
    return 0
  fi
  printf '%s %s\n' "$fingerprint" "$((${streak:-0} + 1))" >"$blocked_file"
  REASON="CI checks fail on your uncommitted changes. Fix them before finishing (AGENTS.md, Enforced by CI).

$failures" node -e 'process.stdout.write(JSON.stringify({decision:"block",reason:process.env.REASON.trimEnd()})+"\n")'
}

(run)
exit 0
