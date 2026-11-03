// Claims wait for a person (supabase/migrations/20261206710000_claims_pending.sql):
// starting a claim records a pending claim only (no venue, no Admin), several
// people can each have one waiting, only a moderator approves, approval makes
// exactly that claimant Admin of one new venue linked to the page, a bar the
// claimant added themselves stays hidden until then, and who sees the page
// only changes once it's theirs.
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
  throw new Error(`Refusing to run claim tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const users = {};
const pages = {};
const DOMAIN = `emberroom${run}.test`;

async function makeUser(label, email = `${label}-${run}@security-test.local`) {
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

async function barPage(key, fields = {}) {
  const { data, error } = await service
    .from('profiles')
    .insert({ kind: 'bar', handle: `${key}${run}`.toLowerCase(), display_name: `${key} ${run}`, is_public: true, ...fields })
    .select('id')
    .single();
  if (error) throw new Error(`fixture page failed: ${error.message}`);
  pages[key] = data.id;
  return data.id;
}

const venueCount = async () => Number((await db.query('SELECT count(*) FROM public.bars')).rows[0].count);
const adminRows = async (barId) => (await db.query('SELECT user_id FROM public.user_bars WHERE bar_id = $1 AND role_level >= 40', [barId])).rows.map((r) => r.user_id);
const page = async (key) => (await db.query('SELECT bar_id, is_public FROM public.profiles WHERE id = $1', [pages[key]])).rows[0];

before(async () => {
  await db.connect();
  users.owner = await makeUser('owner', `jo-${run}@${DOMAIN}`);
  for (const label of ['second', 'stranger', 'adder', 'moderator']) users[label] = await makeUser(label);
  await db.query('INSERT INTO private.app_admins (user_id) VALUES ($1)', [users.moderator.id]);
  await barPage('Ember', { website: `https://www.${DOMAIN}/`, instagram: `ember${run}` });
});

after(async () => {
  const ids = Object.values(users).map((u) => u.id);
  const barIds = (await db.query('SELECT bar_id FROM public.profiles WHERE id = ANY($1) AND bar_id IS NOT NULL', [Object.values(pages)])).rows.map((r) => r.bar_id);
  await db.query('DELETE FROM public.profile_claims WHERE user_id = ANY($1)', [ids]);
  await db.query('DELETE FROM public.profiles WHERE id = ANY($1)', [Object.values(pages)]);
  if (barIds.length) await db.query('DELETE FROM public.bars WHERE id = ANY($1)', [barIds]);
  await db.query('DELETE FROM private.app_admins WHERE user_id = ANY($1)', [ids]);
  for (const id of ids) await service.auth.admin.deleteUser(id);
  await db.end();
});

describe('claims wait for a person', () => {
  const claims = {};

  test("starting a claim, even with a work email at the bar's own domain, makes only a pending claim: no venue, no Admin", async () => {
    const before = await venueCount();
    const { data, error } = await users.owner.client.rpc('start_bar_claim', { p_profile_id: pages.Ember, p_method: 'email' });
    assert.ifError(error);
    assert.equal(data.status, 'pending');
    assert.equal(data.evidence.strong_match, true, 'the strong match is kept for the reviewer');
    assert.equal(data.evidence.auto, false, 'so moderators are emailed that it arrived');
    claims.owner = data.id;
    assert.equal(await venueCount(), before, 'no venue was made');
    const p = await page('Ember');
    assert.equal(p.bar_id, null, 'the page is not linked to anything');
    assert.equal(p.is_public, true, 'a known open bar stays public');
    const roles = (await db.query('SELECT 1 FROM public.user_bars WHERE user_id = $1', [users.owner.id])).rows;
    assert.equal(roles.length, 0, 'the claimant is not an Admin of anything');
  });

  test('a second person can send a claim on the same page, and everyone can see one is waiting', async () => {
    const { data, error } = await users.second.client.rpc('start_bar_claim', { p_profile_id: pages.Ember, p_method: 'instagram' });
    assert.ifError(error);
    assert.equal(data.status, 'pending');
    claims.second = data.id;
    const pending = (await db.query("SELECT user_id FROM public.profile_claims WHERE profile_id = $1 AND status = 'pending'", [pages.Ember])).rows;
    assert.equal(pending.length, 2);
    const seen = await anon.rpc('bar_claim_pending', { p_profile_id: pages.Ember });
    assert.equal(seen.error, null);
    assert.equal(seen.data, true);
    const visible = await anon.from('profiles').select('id').eq('id', pages.Ember);
    assert.equal(visible.data?.length, 1, 'the page is still public');
  });

  test('only a moderator can approve: not the claimant, another claimant or a stranger', async () => {
    for (const who of ['owner', 'second', 'stranger']) {
      const { error } = await users[who].client.rpc('approve_profile_claim', { p_claim_id: claims.owner });
      assert.match(error?.message ?? '', /Only moderators/, `${who} can't approve`);
      const flip = await users[who].client.from('profile_claims').update({ status: 'approved' }).eq('id', claims.owner).select('id');
      assert.equal(flip.data?.length ?? 0, 0, `${who} can't flip the status`);
    }
    assert.equal((await page('Ember')).bar_id, null);
  });

  test('a waiting claimant can only keep who sees the page on the claim', async () => {
    const { error } = await users.owner.client.rpc('save_claim_setup', { p_claim_id: claims.owner, p_setup: { page_visibility: 'open' } });
    assert.equal(error, null);
    assert.equal((await page('Ember')).bar_id, null, 'nothing on the page moved');
  });

  test('approval makes exactly that claimant Admin of one new venue linked to the page, once', async () => {
    const before = await venueCount();
    const { error } = await users.moderator.client.rpc('approve_profile_claim', { p_claim_id: claims.owner });
    assert.ifError(error);
    const p = await page('Ember');
    assert.ok(p.bar_id, 'the page has its venue');
    assert.equal(await venueCount(), before + 1, 'one venue was made');
    assert.deepEqual(await adminRows(p.bar_id), [users.owner.id], 'the claimant, and only them, is its Admin');
    const bar = (await db.query('SELECT page_visibility FROM public.bars WHERE id = $1', [p.bar_id])).rows[0];
    assert.equal(bar.page_visibility, 'open', 'what they kept on the claim applies now');
    const second = (await db.query('SELECT status FROM public.profile_claims WHERE id = $1', [claims.second])).rows[0];
    assert.equal(second.status, 'rejected', 'the other claim is turned down');
    const again = await users.moderator.client.rpc('approve_profile_claim', { p_claim_id: claims.owner });
    assert.ok(again.error, 'approving again does nothing');
    assert.equal(await venueCount(), before + 1);
    assert.equal((await anon.rpc('bar_claim_pending', { p_profile_id: pages.Ember })).data, false);
  });

  test('page_visibility changes only for the approved Admin', async () => {
    const { bar_id } = await page('Ember');
    await db.query("UPDATE public.bars SET page_visibility_changed_at = now() - interval '31 days' WHERE id = $1", [bar_id]);
    const stranger = await users.stranger.client.from('bars').update({ page_visibility: 'locked' }).eq('id', bar_id).select('id');
    assert.equal(stranger.data?.length ?? 0, 0, 'a stranger changes nothing');
    const loser = await users.second.client.from('bars').update({ page_visibility: 'locked' }).eq('id', bar_id).select('id');
    assert.equal(loser.data?.length ?? 0, 0, 'nor the turned-down claimant');
    const owner = await users.owner.client.from('bars').update({ page_visibility: 'locked' }).eq('id', bar_id).select('id');
    assert.ifError(owner.error);
    assert.equal(owner.data?.length, 1, 'the approved Admin can');
  });

  test('a venue with no approved page cannot change who sees a page', async () => {
    const { data: venue, error } = await users.stranger.client.rpc('create_new_bar', {
      p_name: `Own ${run}`, p_visibility: 10, p_generic: 20, p_specific: 30, p_measurement: 30, p_prep: 40,
    });
    assert.ifError(error);
    const res = await users.stranger.client.from('bars').update({ page_visibility: 'locked' }).eq('id', venue.id).select('id');
    assert.match(res.error?.message ?? '', /once your claim on it is approved/);
    await db.query('DELETE FROM public.bars WHERE id = $1', [venue.id]);
  });
});

describe('a bar the claimant added themselves', () => {
  let claimId;

  test('starts hidden once they claim it, while they and moderators can still read it', async () => {
    const { data: added, error } = await users.adder.client.rpc('add_venue', {
      p_name: `Lantern ${run}`, p_address_line: '1 Test Lane', p_city: 'Testville', p_country_code: 'AU',
      p_latitude: -37.8 + Math.random() / 100, p_longitude: 144.9 + Math.random() / 100, p_postcode: '3000', p_region: 'VIC', p_locality: 'Testville',
    });
    assert.ifError(error);
    pages.Lantern = added.id;
    const { data: claim, error: claimError } = await users.adder.client.rpc('start_bar_claim', { p_profile_id: added.id, p_method: 'instagram', p_instagram: `lantern${run}` });
    assert.ifError(claimError);
    assert.equal(claim.status, 'pending');
    assert.equal(claim.evidence.hid_page, true);
    claimId = claim.id;
    assert.equal((await page('Lantern')).is_public, false, 'hidden until approved');
    assert.equal((await anon.from('profiles').select('id').eq('id', added.id)).data?.length ?? 0, 0, "signed-out visitors don't see it");
    assert.equal((await users.stranger.client.from('profiles').select('id').eq('id', added.id)).data?.length ?? 0, 0, 'nor other people');
    assert.equal((await users.adder.client.from('profiles').select('id').eq('id', added.id)).data?.length, 1, 'the claimant still reads it');
    assert.equal((await users.moderator.client.from('profiles').select('id').eq('id', added.id)).data?.length, 1, 'and so does a moderator');
  });

  test('shows again once a moderator approves the claim', async () => {
    const { error } = await users.moderator.client.rpc('approve_profile_claim', { p_claim_id: claimId });
    assert.ifError(error);
    const p = await page('Lantern');
    assert.equal(p.is_public, true);
    assert.deepEqual(await adminRows(p.bar_id), [users.adder.id]);
  });

  test('withdrawn, it shows again as it was before the claim', async () => {
    const { data: added, error } = await users.adder.client.rpc('add_venue', {
      p_name: `Wick ${run}`, p_address_line: '2 Test Lane', p_city: 'Testville', p_country_code: 'AU',
      p_latitude: -37.7 + Math.random() / 100, p_longitude: 144.8 + Math.random() / 100, p_postcode: '3000', p_region: 'VIC', p_locality: 'Testville',
    });
    assert.ifError(error);
    pages.Wick = added.id;
    const { data: claim } = await users.adder.client.rpc('start_bar_claim', { p_profile_id: added.id, p_method: 'instagram', p_instagram: `wick${run}` });
    assert.equal((await page('Wick')).is_public, false);
    const gone = await users.adder.client.from('profile_claims').delete().eq('id', claim.id).select('id');
    assert.equal(gone.data?.length, 1);
    assert.equal((await page('Wick')).is_public, true);
  });

  test('hidden by its creator\'s claim, it shows again once every waiting claim has gone', async () => {
    const { data: added, error } = await users.adder.client.rpc('add_venue', {
      p_name: `Ember Two ${run}`, p_address_line: '3 Test Lane', p_city: 'Testville', p_country_code: 'AU',
      p_latitude: -37.6 + Math.random() / 100, p_longitude: 144.7 + Math.random() / 100, p_postcode: '3000', p_region: 'VIC', p_locality: 'Testville',
    });
    assert.ifError(error);
    pages.EmberTwo = added.id;
    const other = await users.stranger.client.rpc('start_bar_claim', { p_profile_id: added.id, p_method: 'instagram', p_instagram: `embertwo${run}` });
    assert.ifError(other.error);
    const own = await users.adder.client.rpc('start_bar_claim', { p_profile_id: added.id, p_method: 'instagram', p_instagram: `embertwo${run}` });
    assert.ifError(own.error);
    assert.equal((await page('EmberTwo')).is_public, false);
    await db.query("UPDATE public.profile_claims SET status = 'rejected' WHERE id = $1", [own.data.id]);
    assert.equal((await page('EmberTwo')).is_public, false, 'still hidden while another claim waits');
    await users.stranger.client.from('profile_claims').delete().eq('id', other.data.id);
    assert.equal((await page('EmberTwo')).is_public, true, 'shown once none waits');
  });

  test('a claim never opens a page a moderator took down', async () => {
    await barPage('TakenDown', { instagram: `down${run}`, is_public: false });
    await db.query('UPDATE public.profiles SET moderated_at = now() WHERE id = $1', [pages.TakenDown]);
    await users.stranger.client.rpc('start_bar_claim', { p_profile_id: pages.TakenDown, p_method: 'instagram' });
    const read = await users.stranger.client.from('profiles').select('id').eq('id', pages.TakenDown);
    assert.equal(read.data?.length ?? 0, 0);
  });

  test("someone else's claim never hides a known bar", async () => {
    await barPage('Known', { instagram: `known${run}` });
    const { data, error } = await users.second.client.rpc('start_bar_claim', { p_profile_id: pages.Known, p_method: 'instagram' });
    assert.ifError(error);
    assert.equal(data.evidence.hid_page, undefined);
    assert.equal((await page('Known')).is_public, true);
  });
});
