// Venue setup while a bar claim waits: the code shown before sending, page
// settings kept on the claim, invites held until approval
// (supabase/migrations/20261014900000_venue_setup_claims.sql).
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
  throw new Error(`Refusing to run venue setup tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const users = {};
const ids = {};

async function makeUser(label) {
  const email = `${label}-${run}@security-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, email, client };
}

const page = async (name) =>
  (
    await db.query("INSERT INTO public.profiles (kind, handle, display_name, is_public, instagram) VALUES ('bar', $1, $2, true, $1) RETURNING id", [
      `${name}${run}`,
      `${name} ${run}`,
    ])
  ).rows[0].id;

/** What setup does: a private venue of their own, then a claim that links it. */
async function setUp(who, name, code) {
  const { data: venue, error: venueError } = await users[who].client.rpc('create_new_bar', {
    p_name: `${name} ${run}`,
    p_visibility: 10,
    p_generic: 20,
    p_specific: 30,
    p_measurement: 30,
    p_prep: 40,
  });
  assert.ifError(venueError);
  const profileId = await page(name);
  const { data: claim, error } = await users[who].client.rpc('start_bar_claim', {
    p_profile_id: profileId,
    p_method: 'instagram',
    p_bar_id: venue.id,
    p_code: code,
  });
  assert.ifError(error);
  return { venueId: venue.id, profileId, claim };
}

before(async () => {
  await db.connect();
  for (const label of ['owner', 'staff', 'other']) users[label] = await makeUser(label);
});

after(async () => {
  const people = Object.values(users).map((u) => u.id);
  const like = `%${run}%`;
  await db.query('DELETE FROM public.profile_claims WHERE user_id = ANY($1)', [people]);
  await db.query('UPDATE public.profiles SET bar_id = NULL WHERE handle LIKE $1', [like]);
  await db.query('DELETE FROM public.profiles WHERE handle LIKE $1', [like]);
  await db.query("SET session_replication_role = 'replica'");
  await db.query('DELETE FROM public.user_bars WHERE user_id = ANY($1)', [people]);
  await db.query("SET session_replication_role = 'origin'");
  await db.query('DELETE FROM public.bar_invites WHERE email LIKE $1', [like]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('starting a claim during setup', () => {
  test('keeps the code the app showed, and an Instagram claim is a message', async () => {
    const { claim } = await setUp('owner', 'rye', '482913');
    ids.claim = claim.id;
    assert.equal(claim.code, '482913');
    assert.equal(claim.evidence.instagram_dm, true);
    assert.equal(claim.status, 'pending');
  });

  test('refuses a code that is not six digits', async () => {
    const { error } = await users.other.client.rpc('start_bar_claim', { p_profile_id: await page('ember'), p_method: 'phone', p_code: '12ab56' });
    assert.equal(error?.code, '22023');
  });

  test('still makes a code when none is given', async () => {
    const { data, error } = await users.other.client.rpc('start_bar_claim', { p_profile_id: await page('wick'), p_method: 'phone', p_phone: '(555) 010-4417' });
    assert.ifError(error);
    assert.match(data.code, /^[0-9]{6}$/);
  });
});

describe('page settings kept on a waiting claim', () => {
  test('the claimant saves them; the public page stays as it is', async () => {
    const { data, error } = await users.owner.client.rpc('save_claim_setup', {
      p_claim_id: ids.claim,
      p_setup: { page_visibility: 'description', phone: '+61 3 9000 0000', website: 'example.com', timezone: 'Australia/Melbourne', hours: { mon: [], tue: [['17:00', '00:00']] } },
    });
    assert.ifError(error);
    assert.equal(data.setup.page_visibility, 'description');
    const { rows: [row] } = await db.query('SELECT p.phone FROM public.profiles p JOIN public.profile_claims c ON c.profile_id = p.id WHERE c.id = $1', [ids.claim]);
    assert.equal(row.phone, null);
  });

  test('bad values and unknown keys are refused', async () => {
    for (const setup of [{ phone: 'call me' }, { page_visibility: 'public' }, { hours: { mon: [['25:00', '02:00']] } }, { bio: 'hi' }]) {
      const { error } = await users.owner.client.rpc('save_claim_setup', { p_claim_id: ids.claim, p_setup: setup });
      assert.equal(error?.code, '22023', JSON.stringify(setup));
    }
  });

  test('nobody else can save on the claim', async () => {
    const { error } = await users.other.client.rpc('save_claim_setup', { p_claim_id: ids.claim, p_setup: { phone: '123456' } });
    assert.equal(error?.code, '42501');
  });
});

describe('invites while the claim waits', () => {
  test('Join holds the invite instead of joining', async () => {
    const { rows: [claim] } = await db.query('SELECT bar_id FROM public.profile_claims WHERE id = $1', [ids.claim]);
    ids.venue = claim.bar_id;
    const { error: inviteError } = await users.owner.client.rpc('add_user_to_bar_by_email', { p_email: users.staff.email, p_bar_id: ids.venue, p_role_level: 30, p_name: 'Sam' });
    assert.ifError(inviteError);
    const { error } = await users.staff.client.rpc('accept_bar_invite', { p_bar_id: ids.venue });
    assert.ifError(error);
    const { rows } = await db.query('SELECT 1 FROM public.user_bars WHERE bar_id = $1 AND user_id = $2', [ids.venue, users.staff.id]);
    assert.equal(rows.length, 0, 'not a member yet');
    const { data: mine } = await users.staff.client.rpc('my_bar_invites');
    assert.equal(mine.find((i) => i.bar_id === ids.venue)?.held, true);
  });

  test('approving links the page, applies the settings and lets them in', async () => {
    await db.query('SELECT private.hand_over_claim($1, NULL)', [ids.claim]);
    const { rows: [p] } = await db.query('SELECT p.phone, p.timezone, b.page_visibility FROM public.profiles p JOIN public.bars b ON b.id = p.bar_id WHERE b.id = $1', [ids.venue]);
    assert.equal(p.phone, '+61 3 9000 0000');
    assert.equal(p.timezone, 'Australia/Melbourne');
    assert.equal(p.page_visibility, 'description');
    const { rows: [member] } = await db.query('SELECT role_level FROM public.user_bars WHERE bar_id = $1 AND user_id = $2', [ids.venue, users.staff.id]);
    assert.equal(member?.role_level, 30);
    const { rows: left } = await db.query('SELECT 1 FROM public.bar_invites WHERE bar_id = $1', [ids.venue]);
    assert.equal(left.length, 0);
  });

  test('with no claim waiting, Join works as before', async () => {
    const { data: venue } = await users.owner.client.rpc('create_new_bar', { p_name: `Plain ${run}`, p_visibility: 10, p_generic: 20, p_specific: 30, p_measurement: 30, p_prep: 40 });
    await users.owner.client.rpc('add_user_to_bar_by_email', { p_email: users.other.email, p_bar_id: venue.id, p_role_level: 20 });
    const { data, error } = await users.other.client.rpc('accept_bar_invite', { p_bar_id: venue.id });
    assert.ifError(error);
    assert.equal(data.role_level, 20);
  });
});
