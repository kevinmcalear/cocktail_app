// Security and behaviour tests for 20260929400000_city_bars_and_awards:
// awards on profiles, the seeded city bars and their signature drinks, and
// the Library leaving other bars' signatures out. Runs through the real API
// as real users.
//
//   supabase start && supabase db reset
//   npm run test:security
//
// Every fixture is named with a per-run id and removed afterwards.

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
  throw new Error(`Refusing to run award tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
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
  return { id: data.user.id, client };
}

async function serviceInsert(table, row) {
  const { data, error } = await service.from(table).insert(row).select().single();
  if (error) throw new Error(`fixture insert into ${table} failed: ${error.message}`);
  return data;
}

const award = (profileId, extra = {}) => ({
  profile_id: profileId,
  award: `Test List ${run}`,
  year: 2026,
  position: 7,
  source_url: 'https://example.com/list',
  ...extra,
});

// The Library's filter (hooks/useCocktails.ts): other bars' signatures out.
const libraryFilter = (userId) => `bar_id.not.is.null,origin_bar_profile_id.is.null,created_by.eq.${userId}`;

before(async () => {
  await db.connect();
  for (const label of ['member', 'catalogAdmin']) users[label] = await makeUser(label);
  await db.query('INSERT INTO private.app_admins (user_id) VALUES ($1)', [users.catalogAdmin.id]);
  ids.bar = (await serviceInsert('profiles', { kind: 'bar', handle: `awardbar.${run}`, display_name: `Award Bar ${run}`, is_public: true })).id;
  ids.hidden = (await serviceInsert('profiles', { kind: 'bar', handle: `hiddenbar.${run}`, display_name: `Hidden Bar ${run}`, is_public: false })).id;
  await serviceInsert('profile_awards', award(ids.bar));
  await serviceInsert('profile_awards', award(ids.hidden));
});

after(async () => {
  const like = `%${run}%`;
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.profiles WHERE display_name LIKE $1 OR handle LIKE $1', [like]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('profile awards', () => {
  test("anyone reads a public profile's awards; a private profile's stay hidden", async () => {
    for (const client of [anon, users.member.client]) {
      const { data, error } = await client.from('profile_awards').select('profile_id, position').eq('award', `Test List ${run}`);
      assert.ifError(error);
      assert.deepEqual(data, [{ profile_id: ids.bar, position: 7 }]);
    }
  });

  test('only catalog admins add, change or remove awards', async () => {
    const insert = await users.member.client.from('profile_awards').insert(award(ids.bar, { year: 2025 }));
    assert.ok(insert.error, 'a signed-in member cannot add an award');
    const signedOut = await anon.from('profile_awards').insert(award(ids.bar, { year: 2024 }));
    assert.ok(signedOut.error, 'a signed-out visitor cannot add an award');

    const update = await users.member.client.from('profile_awards').update({ position: 1 }).eq('profile_id', ids.bar).select();
    assert.deepEqual(update.data ?? [], [], 'a member changes nothing');
    const del = await users.member.client.from('profile_awards').delete().eq('profile_id', ids.bar).select();
    assert.deepEqual(del.data ?? [], [], 'a member removes nothing');

    const admin = await users.catalogAdmin.client.from('profile_awards').insert(award(ids.bar, { year: 2025, position: null, title: 'Best Test Bar' })).select().single();
    assert.ifError(admin.error);
    const removed = await users.catalogAdmin.client.from('profile_awards').delete().eq('id', admin.data.id).select();
    assert.equal(removed.data.length, 1);
  });

  test('an award needs a place or a title, and an https source', async () => {
    for (const bad of [{ position: null, title: null }, { source_url: 'http://example.com' }, { position: 0 }]) {
      const { error } = await users.catalogAdmin.client.from('profile_awards').insert(award(ids.bar, { year: 2020, ...bad }));
      assert.ok(error, `rejected: ${JSON.stringify(bad)}`);
    }
  });
});

describe('the seed', () => {
  test('the 50 Best 2025 places are awards on the 50 bars, one per place', async () => {
    const { rows } = await db.query(
      `SELECT a.position FROM public.profile_awards a JOIN public.profiles p ON p.id = a.profile_id
       WHERE a.award = 'The World''s 50 Best Bars' AND a.year = 2025 AND a.position <= 50 AND p.kind = 'bar'
       ORDER BY a.position`
    );
    assert.deepEqual(rows.map((r) => r.position), Array.from({ length: 50 }, (_, i) => i + 1));
  });

  test('signature drinks are shared, credited to a public bar, and nobody owns them', async () => {
    const { rows } = await db.query(
      `SELECT count(*)::int AS n,
              count(*) FILTER (WHERE i.bar_id IS NOT NULL OR i.created_by IS NOT NULL OR NOT p.is_public OR p.kind <> 'bar')::int AS bad,
              count(*) FILTER (WHERE i.riff_of_id IS NOT NULL AND NOT c.is_catalog)::int AS bad_riff,
              count(*) FILTER (WHERE (i.riff_of_id IS NULL) <> (i.origin = 'Original'))::int AS bad_origin
       FROM public.items i
       JOIN public.profiles p ON p.id = i.origin_bar_profile_id
       LEFT JOIN public.items c ON c.id = i.riff_of_id
       WHERE i.creator_profile_id IS NULL AND i.origin_bar_profile_id IS NOT NULL AND i.bar_id IS NULL AND i.created_by IS NULL`
    );
    assert.ok(rows[0].n > 0, 'the seed added signature drinks');
    assert.equal(rows[0].bad, 0);
    assert.equal(rows[0].bad_riff, 0);
    assert.equal(rows[0].bad_origin, 0);
  });
});

describe('the Library', () => {
  test("leaves out other bars' signatures but keeps your own drinks and the shared classics", async () => {
    const signature = await serviceInsert('items', { name: `Signature ${run}`, item_type: 'cocktail', created_by: null, origin_bar_profile_id: ids.bar });
    const mine = await users.member.client
      .from('items')
      .insert({ name: `My Riff ${run}`, item_type: 'cocktail', origin_bar_profile_id: ids.bar })
      .select()
      .single();
    assert.ifError(mine.error);
    const shared = await serviceInsert('items', { name: `Shared ${run}`, item_type: 'cocktail', created_by: null });

    const { data, error } = await users.member.client
      .from('app_item_presentation')
      .select('id')
      .like('name', `%${run}%`)
      .or(libraryFilter(users.member.id));
    assert.ifError(error);
    const seen = new Set(data.map((r) => r.id));
    assert.ok(!seen.has(signature.id), "another bar's signature is left out");
    assert.ok(seen.has(mine.data.id), 'your own drink crediting a bar stays');
    assert.ok(seen.has(shared.id), 'a shared drink with no bar credit stays');

    // The bar's profile still lists it under Originals.
    const originals = await users.member.client.from('items').select('id').eq('origin_bar_profile_id', ids.bar);
    assert.ok(originals.data.some((r) => r.id === signature.id));
  });
});
