#!/usr/bin/env node
// Derives a PR's change class from its changed paths, per change-policy.yml,
// and decides whether its approval requirement is met. CI runs this on every PR
// (.github/workflows/change-policy.yml); docs/change_policy.md explains the classes.
//
// Usage:
//   node scripts/change-policy/classify.mjs app/foo.tsx supabase/migrations/x.sql
//   git diff --name-only origin/main...HEAD | node scripts/change-policy/classify.mjs
//   ...--files-from list.txt   read paths from a file instead
//   ...--policy path.yml       policy to apply (default: repo-root change-policy.yml)
//   ...--labels '["a","b"]'    the PR's current labels (JSON array)
//   ...--labeler <login>       who last applied the approval label, or
//   ...--label-events file     GitHub `labeled` events as JSON lines of
//                              {label, actor, at}; the labeler is read from it
//   ...--pushed-at <iso>       when new commits were pushed; an approval label
//                              applied before this is stale
//   ...--json                  machine output (includes the markdown comment)

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { minimatch } from 'minimatch';
import { parse } from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_POLICY = join(here, '..', '..', 'change-policy.yml');
export const COMMENT_MARKER = '<!-- change-policy -->';

export function loadPolicy(path = DEFAULT_POLICY) {
  return parse(readFileSync(path, 'utf8'));
}

const matches = (file, globs) => globs.some((g) => minimatch(file, g, { dot: true }));

// First class (top to bottom) with ANY matching file wins; the last class is
// the fallback, so an empty diff still gets a class.
export function classify(files, policy) {
  const cls =
    policy.classes.find((c) => files.some((f) => matches(f, c.match))) ??
    policy.classes[policy.classes.length - 1];
  return {
    class: cls.id,
    label: cls.label,
    requires: String(cls.requires ?? '').trim(),
    humanApproval: cls.human_approval === true,
    matchedFiles: files.filter((f) => matches(f, cls.match)),
    fileCount: files.length,
  };
}

// Approved only when the label is on the PR AND the last person to apply it is
// a listed approver. Anyone with triage access can add a label; that alone
// must not open the gate. A label applied before the latest push approved
// commits that are no longer the whole PR, so it is stale (CI removes it).
export function approvalStatus(result, policy, { labels = [], labeler = '', labeledAt = '', pushedAt = '' } = {}) {
  const { label, approvers = [] } = policy.approval ?? {};
  if (!result.humanApproval) return { required: false, approved: true, reason: 'No human approval needed.' };
  if (!label || !labels.includes(label)) {
    return { required: true, approved: false, reason: `Waiting for the \`${label}\` label from ${who(approvers)}.` };
  }
  if (pushedAt && !(Date.parse(labeledAt) >= Date.parse(pushedAt))) {
    return {
      required: true,
      approved: false,
      stale: true,
      label,
      reason: `New commits were pushed after \`${label}\` was applied, so the approval was reset. ${who(approvers)} re-applies it after reviewing them.`,
    };
  }
  if (!approvers.includes(labeler)) {
    return {
      required: true,
      approved: false,
      reason: `\`${label}\` was applied by \`${labeler || 'unknown'}\`, who is not an approver. It must be applied by ${who(approvers)}.`,
    };
  }
  return { required: true, approved: true, reason: `Approved: \`${label}\` applied by \`${labeler}\`.` };
}

// The most recent `labeled` event for `label`, as { actor, at } (empty if none).
export function lastLabeled(events, label) {
  const hits = events.filter((e) => e.label === label).sort((a, b) => String(a.at).localeCompare(String(b.at)));
  return { actor: hits.at(-1)?.actor ?? '', at: hits.at(-1)?.at ?? '' };
}

const who = (logins) => logins.map((l) => `\`${l}\``).join(' or ') || 'an approver';
// File names come from the PR, so keep them from breaking out of inline code.
const code = (s) => `\`${String(s).replaceAll('`', "'")}\``;

export function toMarkdown(result, approval) {
  const lines = [`### Change routing: \`${result.class}\``, '', `**${result.label}.** ${result.requires}`, ''];
  if (result.humanApproval) {
    const shown = result.matchedFiles.slice(0, 10).map(code).join(', ');
    const more = result.matchedFiles.length > 10 ? ` and ${result.matchedFiles.length - 10} more` : '';
    lines.push(`Triggered by ${shown}${more}.`, '');
    lines.push(`${approval.approved ? '✅' : '⛔'} ${approval.reason}`, '');
  }
  lines.push(`<sub>${result.fileCount} file(s) changed · rules: \`change-policy.yml\` on the base branch</sub>`, '', COMMENT_MARKER);
  return lines.join('\n');
}

// --- CLI ---

const splitLines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean);

function parseArgs(argv) {
  const flags = new Set(['--files-from', '--policy', '--labels', '--labeler', '--label-events', '--pushed-at']);
  const opts = { files: [], json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (flags.has(a)) opts[a.slice(2)] = argv[++i] ?? '';
    else opts.files.push(a);
  }
  return opts;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const opts = parseArgs(process.argv.slice(2));
  let files = opts.files;
  if (opts['files-from'] !== undefined) files = splitLines(readFileSync(opts['files-from'], 'utf8'));
  else if (!files.length && !process.stdin.isTTY) files = splitLines(readFileSync(0, 'utf8'));

  const policy = loadPolicy(opts.policy || DEFAULT_POLICY);
  const result = classify(files, policy);
  let labeled = { actor: opts.labeler ?? '', at: '' };
  if (opts['label-events'] !== undefined) {
    const events = splitLines(readFileSync(opts['label-events'], 'utf8')).map((l) => JSON.parse(l));
    labeled = lastLabeled(events, policy.approval?.label);
  }
  const approval = approvalStatus(result, policy, {
    labels: opts.labels ? JSON.parse(opts.labels) : [],
    labeler: labeled.actor,
    labeledAt: labeled.at,
    pushedAt: opts['pushed-at'] ?? '',
  });
  const markdown = toMarkdown(result, approval);
  process.stdout.write((opts.json ? JSON.stringify({ ...result, approval, markdown }) : markdown) + '\n');
}
