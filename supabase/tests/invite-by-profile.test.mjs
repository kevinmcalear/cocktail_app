// Inviting a person found by name (Kept-team, Invite > By email), including at
// one of the bar's own roles: public.invite_profile_to_bar
// (supabase/migrations/20261206330000_invite_by_profile.sql). The sender picks
// a person's page and never gets their email; the invite rules are the ones
// add_user_to_bar_by_email and invite_to_role already hold.
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
  throw new Error(`Refusing to run invite-by-profile tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });
const users = {};
const ids = {};

async function makeUser(label) {
  const email = `${label}-${run}@invite-profile.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, email, client };
}

async function insert(table, row) {
  const { data, error } = await service.from(table).insert(row).select().single();
  if (error) throw new Error(`fixture insert into ${table} failed: ${error.message}`);
  return data;
}

const page = (user, name, extra = {}) =>
  insert('profiles', { kind: 'person', handle: `${name.toLowerCase().replace(/\W/g, '')}${run}`, display_name: `${name} ${run}`, is_public: true, user_id: user?.id ?? null, ...extra });

const invite = (as, args) =>
  as.client.rpc('invite_profile_to_bar', { p_profile_id: args.profile, p_bar_id: args.bar ?? ids.bar, p_role_level: args.level ?? 30, p_role_id: args.role ?? null, p_note: args.note ?? null });

before(async () => {
  await db.connect();
  for (const label of ['admin', 'bartender', 'sam', 'jo', 'hidden', 'member']) users[label] = await makeUser(label);
  ids.bar = (await insert('bars', { name: `Little Rye ${run}` })).id;
  ids.other = (await insert('bars', { name: `Other bar ${run}` })).id;
  await insert('user_bars', { bar_id: ids.bar, user_id: users.admin.id, role_level: 40 });
  await insert('user_bars', { bar_id: ids.bar, user_id: users.bartender.id, role_level: 30 });
  await insert('user_bars', { bar_id: ids.bar, user_id: users.member.id, role_level: 20 });
  ids.takeover = (await insert('venue_roles', { bar_id: ids.bar, name: `Takeover bartender ${run}`, base_level: 30, ends_at: new Date(Date.now() + 3 * 86400000).toISOString() })).id;
  ids.elsewhere = (await insert('venue_roles', { bar_id: ids.other, name: `Elsewhere ${run}`, base_level: 30 })).id;
  ids.sam = (await page(users.sam, 'Sam')).id;
  ids.jo = (await page(users.jo, 'Jo')).id;
  ids.hidden = (await page(users.hidden, 'Hidden', { is_public: false })).id;
  ids.unclaimed = (await page(null, 'Nobody')).id;
  ids.member = (await page(users.member, 'Mem')).id;
  ids.barPage = (await insert('profiles', { kind: 'bar', handle: `littlerye${run}`, display_name: `Little Rye page ${run}`, bar_id: ids.bar, is_public: true })).id;
});

after(async () => {
  const userIds = Object.values(users).map((u) => u.id);
  await db.query('DELETE FROM private.rate_events WHERE user_id = ANY($1) OR bar_id = ANY($2)', [userIds, [ids.bar, ids.other]]);
  for (const id of [ids.sam, ids.jo, ids.hidden, ids.unclaimed, ids.member, ids.barPage]) if (id) await service.from('profiles').delete().eq('id', id);
  for (const id of [ids.bar, ids.other]) if (id) await service.from('bars').delete().eq('id', id);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
  await db.end();
});

describe('inviting a person found by name', () => {
  test('an Admin invites a page; the invite is theirs, and the reply carries no email', async () => {
    const { data, error } = await invite(users.admin, { profile: ids.sam, level: 35, note: 'Thursday opening.' });
    assert.ifError(error);
    assert.equal(data, true, 'an invite was made');
    const { rows } = await db.query('SELECT email, role_level, name, note, venue_role_id FROM public.bar_invites WHERE bar_id = $1', [ids.bar]);
    assert.deepEqual(rows, [{ email: users.sam.email, role_level: 35, name: `Sam ${run}`, note: 'Thursday opening.', venue_role_id: null }]);
    assert.ok(!JSON.stringify(data).includes('@'));
  });

  test('at one of the bar’s own roles, the invite names the role', async () => {
    const { data, error } = await invite(users.admin, { profile: ids.jo, role: ids.takeover });
    assert.ifError(error);
    assert.equal(data, true);
    const { rows } = await db.query('SELECT role_level, venue_role_id FROM public.bar_invites WHERE bar_id = $1 AND email = $2', [ids.bar, users.jo.email]);
    assert.deepEqual(rows, [{ role_level: 30, venue_role_id: ids.takeover }]);
    // The invitee sees it with their own invites and accepts it onto the role.
    const mine = await users.jo.client.rpc('accept_bar_invite', { p_bar_id: ids.bar });
    assert.ifError(mine.error);
    const { rows: seat } = await db.query('SELECT role_level, venue_role_id FROM public.user_bars WHERE bar_id = $1 AND user_id = $2', [ids.bar, users.jo.id]);
    assert.deepEqual(seat, [{ role_level: 30, venue_role_id: ids.takeover }]);
  });

  test('another bar’s role, or an unknown one, is refused', async () => {
    const other = await invite(users.admin, { profile: ids.sam, role: ids.elsewhere });
    assert.match(other.error?.message ?? '', /isn't one of this bar's/);
    const unknown = await invite(users.admin, { profile: ids.sam, role: randomUUID() });
    assert.ok(unknown.error);
  });

  test('someone already on the team just gets the new built-in role', async () => {
    const { data, error } = await invite(users.admin, { profile: ids.member, level: 35 });
    assert.ifError(error);
    assert.equal(data, false, 'no invite, a role change');
    const { rows } = await db.query('SELECT role_level FROM public.user_bars WHERE bar_id = $1 AND user_id = $2', [ids.bar, users.member.id]);
    assert.equal(rows[0].role_level, 35);
  });

  test('the invite rules still hold: a Bartender without staff can’t invite', async () => {
    const byBartender = await invite(users.bartender, { profile: ids.sam, level: 40 });
    assert.ok(byBartender.error, 'a Bartender without the staff permission can’t invite at all');
  });
});

describe('finding by name does not open a way to ask who has an account', () => {
  const NOT_THERE = /haven't joined the app yet/;

  test('a private page, a page nobody has claimed and a bar’s page all read the same', async () => {
    for (const profile of [ids.hidden, ids.unclaimed, ids.barPage, randomUUID()]) {
      const { error } = await invite(users.admin, { profile });
      assert.match(error?.message ?? '', NOT_THERE, String(profile));
    }
    const { rows } = await db.query('SELECT email FROM public.bar_invites WHERE bar_id = $1 AND email = $2', [ids.bar, users.hidden.email]);
    assert.equal(rows.length, 0);
  });

  test('someone without the staff permission gets one refusal whatever the page', async () => {
    const messages = [];
    for (const profile of [ids.sam, ids.hidden, ids.unclaimed, randomUUID()]) {
      const { error } = await invite(users.bartender, { profile });
      messages.push(error?.message);
    }
    assert.equal(new Set(messages).size, 1, 'the same words for an account, a private page and no page');
    assert.match(messages[0], /invite and manage staff permission/);
  });

  test('it can’t be called signed out', async () => {
    const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
    const { error } = await anon.rpc('invite_profile_to_bar', { p_profile_id: ids.sam, p_bar_id: ids.bar, p_role_level: 30 });
    assert.ok(error, 'anon has no execute grant');
  });
});
