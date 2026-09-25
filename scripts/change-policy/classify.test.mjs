// Pins the routing in change-policy.yml. Hermetic: no git, no network.
//
//   npm run test:policy

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { approvalStatus, classify, COMMENT_MARKER, lastLabeled, loadPolicy, toMarkdown } from './classify.mjs';

const policy = loadPolicy();
const classOf = (...files) => classify(files, policy).class;

test('every listed blast-radius path routes to blast-radius', () => {
  for (const f of [
    'supabase/migrations/20260901000000_add_table.sql',
    'supabase/seed_categories.sql',
    'supabase/schemas/policies.sql',
    'supabase/config.toml',
    'supabase/functions/_shared/auth.ts',
    'supabase/functions/delete-account/index.ts',
    'lib/roles.ts',
    'app/auth/login.tsx',
    'app/auth/nested/screen.tsx',
    'components/auth/SignInScreen.tsx',
    'ctx/AuthContext.tsx',
    'lib/authRedirect.ts',
    'lib/parseAuthParams.ts',
    'lib/createSessionFromUrl.ts',
    'change-policy.yml',
    'scripts/change-policy/classify.mjs',
    '.github/workflows/change-policy.yml',
  ]) {
    assert.equal(classOf(f), 'blast-radius', f);
  }
});

test('other edge functions route to backend', () => {
  assert.equal(classOf('supabase/functions/venue-app/index.ts'), 'backend');
  assert.equal(classOf('supabase/functions/_shared/http.ts'), 'backend');
});

test('everything else routes to app, including dotfiles', () => {
  assert.equal(classOf('app/(tabs)/index.tsx'), 'app');
  assert.equal(classOf('lib/rolesHelpers.ts'), 'app');
  assert.equal(classOf('docs/change_policy.md'), 'app');
  assert.equal(classOf('.github/workflows/ci.yml'), 'app');
  assert.equal(classOf('supabase/tests/security.test.mjs'), 'app');
});

test('one risky file routes the whole PR to the stricter class', () => {
  assert.equal(classOf('app/(tabs)/index.tsx', 'supabase/functions/venue-app/index.ts'), 'backend');
  assert.equal(
    classOf('app/(tabs)/index.tsx', 'supabase/functions/venue-app/index.ts', 'supabase/migrations/x.sql'),
    'blast-radius'
  );
});

test('an empty diff falls back to the default class', () => {
  assert.equal(classOf(), 'app');
});

test('blast-radius needs the label from a listed approver', () => {
  const r = classify(['supabase/migrations/x.sql', 'app/index.tsx'], policy);
  assert.deepEqual(r.matchedFiles, ['supabase/migrations/x.sql']);

  assert.equal(approvalStatus(r, policy, { labels: [] }).approved, false);
  assert.equal(approvalStatus(r, policy, { labels: ['human-approved'], labeler: 'some-bot' }).approved, false);
  assert.equal(approvalStatus(r, policy, { labels: ['other'], labeler: 'kevinmcalear' }).approved, false);
  assert.equal(approvalStatus(r, policy, { labels: ['human-approved'], labeler: 'kevinmcalear' }).approved, true);
});

test('the labeler is whoever applied the label most recently', () => {
  const events = [
    { label: 'human-approved', actor: 'someone-else', at: '2026-09-02T00:00:00Z' },
    { label: 'human-approved', actor: 'kevinmcalear', at: '2026-09-01T00:00:00Z' },
    { label: 'bug', actor: 'kevinmcalear', at: '2026-09-03T00:00:00Z' },
  ];
  assert.deepEqual(lastLabeled(events, 'human-approved'), { actor: 'someone-else', at: '2026-09-02T00:00:00Z' });
  assert.deepEqual(lastLabeled([], 'human-approved'), { actor: '', at: '' });
});

test('a push after the label resets approval; a label after the push stands', () => {
  const r = classify(['lib/roles.ts'], policy);
  const approved = { labels: ['human-approved'], labeler: 'kevinmcalear', labeledAt: '2026-09-01T10:00:00Z' };

  const stale = approvalStatus(r, policy, { ...approved, pushedAt: '2026-09-01T11:00:00Z' });
  assert.equal(stale.approved, false);
  assert.equal(stale.stale, true);
  assert.equal(stale.label, 'human-approved');

  // Kevin re-labels after reviewing the push (or the labeled run races the push run).
  assert.equal(approvalStatus(r, policy, { ...approved, pushedAt: '2026-09-01T09:00:00Z' }).approved, true);
  // No push in this run (labeled/opened events): the label stands.
  assert.equal(approvalStatus(r, policy, approved).approved, true);
  // A push with no record of when the label was applied fails safe.
  assert.equal(approvalStatus(r, policy, { ...approved, labeledAt: '', pushedAt: '2026-09-01T11:00:00Z' }).stale, true);
});

test('non-blast-radius classes need no approval', () => {
  const r = classify(['supabase/functions/venue-app/index.ts'], policy);
  assert.deepEqual(approvalStatus(r, policy), { required: false, approved: true, reason: 'No human approval needed.' });
});

test('the comment names the class and carries the marker used to update it', () => {
  const r = classify(['supabase/migrations/`x`.sql'], policy);
  const md = toMarkdown(r, approvalStatus(r, policy));
  assert.match(md, /Change routing: `blast-radius`/);
  assert.match(md, /⛔ Waiting for the `human-approved` label/);
  assert.match(md, /`supabase\/migrations\/'x'\.sql`/);
  assert.ok(md.endsWith(COMMENT_MARKER));
});
