#!/usr/bin/env bash
# PreToolUse(Bash) hook — enforces AGENTS.md "never commit to main".
# Blocks `git commit` while the branch of the repo the command actually runs in
# is main/master, and blocks direct pushes to main/master. This is the
# deterministic core: a rule the agent CANNOT skip, unlike an instruction it can
# under-weight. Exit 2 = block + show message.
#
# The branch is resolved from the payload's `cwd` (the Bash tool's working
# directory) — NOT from CLAUDE_PROJECT_DIR, which points at the primary checkout
# and made every agent worktree look like it was sitting on main. `cd <dir> &&`
# and `git -C <dir>` are followed so the check tracks the repo git will really
# write to, in either direction: a worktree on a feature branch is allowed, and
# `git -C <primary-checkout>` from a worktree is still blocked.
set -uo pipefail

command -v python3 >/dev/null 2>&1 || exit 0

payload=$(cat)
[ -z "$payload" ] && exit 0

read -r -d '' GUARD <<'PYEOF' || true
import json
import os
import re
import shlex
import subprocess
import sys

PROTECTED = ("main", "master")

# git global options that consume the NEXT token as their value.
GLOBAL_VALUE_OPTS = {
    "-C", "-c", "--git-dir", "--work-tree", "--namespace",
    "--exec-path", "--config-env", "--super-prefix", "--attr-source",
}
# Global options that decide WHICH repo git operates on. These get replayed onto
# the probe command so git itself resolves the target repo exactly as it would
# for the real command (including a chain of relative -C values).
REPO_LOCATING = {"-C", "--git-dir", "--work-tree"}

# `git push` options that consume the next token, so it isn't mistaken for a
# remote or a refspec.
PUSH_VALUE_OPTS = {"--repo", "-o", "--push-option", "--receive-pack", "--exec"}

# Prefixes that run a command without being one: `FOO=bar git ...`, `sudo git ...`.
WRAPPERS = {"sudo", "command", "nohup", "exec", "time", "env"}
ASSIGNMENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=")

SEPARATOR_CHARS = set(";&|()<>{}")


def tokenize(cmd):
    # shlex treats newlines as plain whitespace, which would glue two commands
    # into one segment ("git checkout -b x\ngit commit" -> commit reads as an
    # argument to checkout). Turn them into explicit separators first.
    lexer = shlex.shlex(cmd.replace("\n", " ; "), posix=True, punctuation_chars=True)
    lexer.whitespace_split = True
    try:
        return list(lexer)
    except ValueError:
        return None  # unbalanced quotes — nothing reliable to inspect


def split_segments(tokens):
    segments, current = [], []
    for token in tokens:
        if token and all(ch in SEPARATOR_CHARS for ch in token):
            if current:
                segments.append(current)
            current = []
        else:
            current.append(token)
    if current:
        segments.append(current)
    return segments


def strip_wrappers(segment):
    i = 0
    while i < len(segment) and (ASSIGNMENT.match(segment[i]) or segment[i] in WRAPPERS):
        i += 1
    return segment[i:]


def is_git(token):
    # `$(git ...)` tokenizes the `$` off; backticks stay attached to the word.
    name = token.lstrip("`$(")
    return name == "git" or name.endswith("/git")


def parse_git(segment):
    """-> (repo-locating global opts, subcommand, subcommand args)"""
    i = 1
    locating = []
    while i < len(segment):
        token = segment[i]
        if not token.startswith("-"):
            break
        if token == "--":
            i += 1
            break
        if token in GLOBAL_VALUE_OPTS:
            value = segment[i + 1] if i + 1 < len(segment) else None
            if token in REPO_LOCATING and value is not None:
                locating += [token, value]
            i += 2
            continue
        if token.startswith("--") and "=" in token:
            if token.split("=", 1)[0] in REPO_LOCATING:
                locating.append(token)
        i += 1
    subcommand = segment[i] if i < len(segment) else None
    return locating, subcommand, segment[i + 1:]


def branch_of(cwd, locating):
    """Branch of the repo the command targets, or None if it can't be resolved."""
    try:
        result = subprocess.run(
            ["git", *locating, "branch", "--show-current"],
            cwd=cwd, capture_output=True, text=True, timeout=5,
        )
    except Exception:
        return None
    if result.returncode != 0:
        return None
    return result.stdout.strip()  # "" on detached HEAD — not protected


def push_positionals(args):
    positionals, i = [], 0
    while i < len(args):
        arg = args[i]
        if arg == "--":
            positionals += args[i + 1:]
            break
        if arg.startswith("-"):
            i += 2 if arg in PUSH_VALUE_OPTS else 1
            continue
        positionals.append(arg)
        i += 1
    return positionals


def refspec_target(refspec):
    refspec = refspec.lstrip("+")
    target = refspec.split(":", 1)[1] if ":" in refspec else refspec
    if target.startswith("refs/heads/"):
        target = target[len("refs/heads/"):]
    return target


def block(message):
    sys.stderr.write(message + "\n")
    sys.exit(2)


def main():
    payload = json.load(sys.stdin)
    if payload.get("tool_name", "Bash") != "Bash":
        return
    command = (payload.get("tool_input") or {}).get("command") or ""
    if not command.strip():
        return

    start_dir = payload.get("cwd") or os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()

    tokens = tokenize(command)
    if tokens is None:
        return

    cwd = start_dir
    for segment in split_segments(tokens):
        segment = strip_wrappers(segment)
        if not segment:
            continue

        if segment[0] in ("cd", "pushd"):
            target = next((a for a in segment[1:] if not a.startswith("-")), None)
            cwd = (os.path.normpath(os.path.join(cwd, os.path.expanduser(target)))
                   if target else os.path.expanduser("~"))
            continue

        if not is_git(segment[0]):
            continue

        locating, subcommand, args = parse_git(segment)
        if subcommand not in ("commit", "push"):
            continue

        # An unresolvable target (a path that doesn't exist, an unexpanded $VAR)
        # falls back to where the command starts, so the guard still applies.
        branch = branch_of(cwd, locating)
        if branch is None:
            branch = branch_of(start_dir, []) or ""

        if subcommand == "commit":
            if branch in PROTECTED:
                block(
                    "BLOCKED: never commit to '%s' (AGENTS.md). "
                    "Branch first: git checkout -b <feat|fix|docs>/<name>" % branch
                )
            continue

        positionals = push_positionals(args)
        targets = [refspec_target(r) for r in positionals[1:]]
        for target in targets:
            if target in PROTECTED:
                block("BLOCKED: never push directly to '%s'. Open a PR from a branch." % target)
        # No refspec means git pushes the current branch.
        if not targets and branch in PROTECTED:
            block("BLOCKED: never push directly to '%s'. Open a PR from a branch." % branch)


try:
    main()
except SystemExit:
    raise
except Exception:
    sys.exit(0)  # a guard bug must never wedge the Bash tool
PYEOF

printf '%s' "$payload" | python3 -c "$GUARD"
exit $?
