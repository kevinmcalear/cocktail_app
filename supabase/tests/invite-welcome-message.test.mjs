// The invite email's own words: a venue's welcome message (Admins write it,
// the invitee reads it through my_bar_invites) and a note on one invite
// (supabase/migrations/20261125100000_invite_welcome_message.sql).
// Runs against the local stack only: `npm run test:security`.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run invite welcome tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const users = {};
let barId;

async function makeUser(label) {
  const email = `${label}-${run}@security-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, email, client };
}

before(async () => {
  await db.connect();
  for (const label of ['admin', 'bartender', 'invitee']) users[label] = await makeUser(label);
  const { rows } = await db.query('INSERT INTO public.bars (name) VALUES ($1) RETURNING id', [`Little Rye ${run}`]);
  barId = rows[0].id;
  await db.query('INSERT INTO public.user_bars (bar_id, user_id, role_level) VALUES ($1, $2, 40), ($1, $3, 30)', [barId, users.admin.id, users.bartender.id]);
});

after(async () => {
  const ids = Object.values(users).map((u) => u.id);
  await db.query('DELETE FROM private.rate_events WHERE user_id = ANY($1) OR bar_id = $2', [ids, barId]);
  await db.query('DELETE FROM public.bars WHERE id = $1', [barId]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

const welcome = 'Welcome to Little Rye. Ask me anything.';

describe('the welcome message', () => {
  test('an Admin saves it; a Bartender can neither change it nor make it too long', async () => {
    const { error } = await users.admin.client.from('bars').update({ welcome_message: welcome }).eq('id', barId);
    assert.ifError(error);
    // RLS leaves a Bartender no row to change: no error, and nothing changes (checked below).
    await users.bartender.client.from('bars').update({ welcome_message: 'Mine now.' }).eq('id', barId);
    const { error: long } = await users.admin.client.from('bars').update({ welcome_message: 'x'.repeat(601) }).eq('id', barId);
    assert.match(long?.message ?? '', /bars_welcome_message_check/);
    const { rows } = await db.query('SELECT welcome_message FROM public.bars WHERE id = $1', [barId]);
    assert.equal(rows[0].welcome_message, welcome);
  });
});

describe('a note on an invite', () => {
  test('the invite keeps its note; the invitee sees the welcome message, not the note', async () => {
    const { error } = await users.admin.client.rpc('add_user_to_bar_by_email', {
      p_email: users.invitee.email, p_bar_id: barId, p_role_level: 30, p_name: 'Sam', p_note: '  Thursday opening, with Jo.  ',
    });
    assert.ifError(error);
    const { data: invites } = await users.admin.client.from('bar_invites').select('note').eq('bar_id', barId);
    assert.deepEqual(invites, [{ note: 'Thursday opening, with Jo.' }]);

    // Made again with no note, it keeps the one it had.
    const { error: again } = await users.admin.client.rpc('add_user_to_bar_by_email', { p_email: users.invitee.email, p_bar_id: barId, p_role_level: 20 });
    assert.ifError(again);
    const { rows } = await db.query('SELECT note, role_level FROM public.bar_invites WHERE bar_id = $1', [barId]);
    assert.deepEqual(rows, [{ note: 'Thursday opening, with Jo.', role_level: 20 }]);

    const { data: mine, error: mineError } = await users.invitee.client.rpc('my_bar_invites');
    assert.ifError(mineError);
    assert.equal(mine.length, 1);
    assert.equal(mine[0].welcome_message, welcome);
    assert.equal('note' in mine[0], false);
  });

  test('a note longer than 500 characters is refused', async () => {
    const { error } = await users.admin.client.rpc('add_user_to_bar_by_email', {
      p_email: `long-${run}@example.test`, p_bar_id: barId, p_role_level: 30, p_note: 'x'.repeat(501),
    });
    assert.match(error?.message ?? '', /500 characters/);
  });
});
