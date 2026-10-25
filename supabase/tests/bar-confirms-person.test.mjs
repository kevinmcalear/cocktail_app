// The bar confirms you (find yourself, step 4): a person claim can ask a bar
// the page lists them at, and that bar's Admin approves it in one tap
// (supabase/migrations/20261113310000_bar_confirms_person.sql).
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
  throw new Error(`Refusing to run bar confirm tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const users = {};
const ids = {};
const pages = [];
const bars = [];

async function makeUser(label) {
  const email = `${label}-${run}@security-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];

async function page(key, kind, fields = {}) {
  const cols = { kind, handle: `${key}${run}`.toLowerCase(), display_name: `${key} ${run}`, is_public: true, ...fields };
  const names = Object.keys(cols);
  const row = await one(`INSERT INTO public.profiles (${names.join(', ')}) VALUES (${names.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`, Object.values(cols));
  pages.push(row.id);
  ids[key] = row.id;
  return row.id;
}

/** A job on a person's page at a bar, listed `ago` before now. */
const job = (person, bar, ago) =>
  db.query("INSERT INTO public.profile_positions (person_profile_id, bar_profile_id, title, is_current, created_at) VALUES ($1, $2, 'Bartender', true, now() - $3::interval)", [ids[person], ids[bar], ago]);

const claim = (who, pageKey, extra = {}) => users[who].client.rpc('start_person_claim', { p_profile_id: ids[pageKey], p_method: 'note', ...extra });

before(async () => {
  await db.connect();
  for (const label of ['ash', 'jo', 'admin', 'bartender', 'stranger', 'otheradmin']) users[label] = await makeUser(label);
  ids.venue = (await one('INSERT INTO public.bars (name) VALUES ($1) RETURNING id', [`Confirm Bar ${run}`])).id;
  ids.otherVenue = (await one('INSERT INTO public.bars (name) VALUES ($1) RETURNING id', [`Other Bar ${run}`])).id;
  bars.push(ids.venue, ids.otherVenue);
  // The bar page was claimed an hour ago; Unclaimed has no venue.
  await page('Moth', 'bar', { bar_id: ids.venue });
  await db.query("UPDATE public.profiles SET claimed_at = now() - interval '1 hour' WHERE id = $1", [ids.Moth]);
  await page('Unclaimed', 'bar');
  await page('Ash', 'person');
  await page('Late', 'person');
  await page('Admins', 'person');
  await job('Ash', 'Moth', '2 days');
  await job('Admins', 'Moth', '2 days');
  await job('Ash', 'Unclaimed', '2 days');
  // Listed after the bar was claimed: its Admin could have added it.
  await job('Late', 'Moth', '1 minute');
  await db.query('INSERT INTO public.user_bars (user_id, bar_id, role_level) VALUES ($1, $2, 40), ($3, $2, 30), ($4, $5, 40)', [
    users.admin.id,
    ids.venue,
    users.bartender.id,
    users.otheradmin.id,
    ids.otherVenue,
  ]);
});

after(async () => {
  const userIds = Object.values(users).map((u) => u.id);
  await db.query('DELETE FROM public.profile_claims WHERE user_id = ANY($1)', [userIds]);
  await db.query('DELETE FROM public.profiles WHERE id = ANY($1) OR user_id = ANY($2)', [pages, userIds]);
  await db.query('DELETE FROM public.bars WHERE id = ANY($1)', [bars]);
  for (const id of userIds) await service.auth.admin.deleteUser(id);
  await db.end();
});

describe('asking the bar', () => {
  test('only a claimed bar the page listed before it was claimed', async () => {
    assert.match((await claim('jo', 'Ash', { p_confirm_bar: ids.Unclaimed })).error?.message ?? '', /can't confirm you yet/);
    assert.match((await claim('jo', 'Late', { p_confirm_bar: ids.Moth })).error?.message ?? '', /can't confirm you yet/);
  });

  test('the claim records which bar it asked', async () => {
    const { data, error } = await claim('ash', 'Ash', { p_confirm_bar: ids.Moth });
    assert.ifError(error);
    assert.equal(data.evidence.confirm_bar, ids.Moth);
    ids.ashClaim = data.id;
  });
});

describe('the bar confirms', () => {
  test('signed out has no execute', async () => {
    assert.ok((await anon.rpc('person_claims_to_confirm', { p_bar_id: ids.venue })).error);
    assert.ok((await anon.rpc('confirm_person_claim', { p_claim_id: ids.ashClaim })).error);
  });

  test('only the venue’s Admins see it waiting', async () => {
    const list = await users.admin.client.rpc('person_claims_to_confirm', { p_bar_id: ids.venue });
    assert.ifError(list.error);
    assert.deepEqual(list.data.map((r) => r.id), [ids.ashClaim]);
    assert.equal(list.data[0].page_id, ids.Ash);
    for (const who of ['bartender', 'stranger', 'otheradmin']) {
      const rows = await users[who].client.rpc('person_claims_to_confirm', { p_bar_id: ids.venue });
      assert.equal(rows.data.length, 0, who);
    }
  });

  test('a Bartender, another venue’s Admin and the claimant cannot confirm', async () => {
    for (const who of ['bartender', 'otheradmin', 'ash', 'stranger']) {
      const { error } = await users[who].client.rpc('confirm_person_claim', { p_claim_id: ids.ashClaim });
      assert.match(error?.message ?? '', /isn't waiting on you/, who);
    }
    assert.equal((await one('SELECT status FROM public.profile_claims WHERE id = $1', [ids.ashClaim])).status, 'pending');
  });

  test('the Admin confirms and the page is theirs', async () => {
    const { error } = await users.admin.client.rpc('confirm_person_claim', { p_claim_id: ids.ashClaim });
    assert.ifError(error);
    const row = await one('SELECT status, evidence FROM public.profile_claims WHERE id = $1', [ids.ashClaim]);
    assert.equal(row.status, 'approved');
    assert.equal(row.evidence.confirmed_by_bar, users.admin.id);
    assert.equal((await one('SELECT user_id FROM public.profiles WHERE id = $1', [ids.Ash])).user_id, users.ash.id);
    const again = await users.admin.client.rpc('confirm_person_claim', { p_claim_id: ids.ashClaim });
    assert.ok(again.error, 'a settled claim cannot be confirmed again');
  });

  test('an Admin cannot confirm their own claim', async () => {
    const mine = await claim('admin', 'Admins', { p_confirm_bar: ids.Moth });
    assert.ifError(mine.error);
    const list = await users.admin.client.rpc('person_claims_to_confirm', { p_bar_id: ids.venue });
    assert.equal(list.data.length, 0);
    assert.match((await users.admin.client.rpc('confirm_person_claim', { p_claim_id: mine.data.id })).error?.message ?? '', /isn't waiting on you/);
  });

  test('a claim that didn’t ask the bar isn’t the bar’s to confirm', async () => {
    const asked = await claim('jo', 'Late');
    assert.ifError(asked.error);
    assert.match((await users.admin.client.rpc('confirm_person_claim', { p_claim_id: asked.data.id })).error?.message ?? '', /isn't waiting on you/);
  });
});
