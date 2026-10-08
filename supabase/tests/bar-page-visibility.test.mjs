// Bar page visibility: an unclaimed bar's drinks show names, credits and
// descriptions but not their specs, and a claimed bar's Admins choose Locked,
// Names + descriptions or Open
// (supabase/migrations/20261007130000_bar_page_visibility.sql). Signed out
// sees the same card, never a spec (20261009300000_signed_out_drink_cards.sql).
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
  throw new Error(`Refusing to run page visibility tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const users = {};
const ids = { items: {} };

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

const specRows = async (client, key) => {
  const { data, error } = await client.from('app_recipe_presentation').select('amount, display_ingredient_id').eq('recipe_item_id', ids.items[key]);
  assert.ifError(error);
  return data;
};

const methods = async (client, key) => {
  const { data, error } = await client.from('item_methods').select('method_item_id').eq('item_id', ids.items[key]);
  assert.ifError(error);
  return data;
};

const published = async (client, key) => {
  const { data, error } = await client
    .from('published_items')
    .select('name, description, publish_mode, creator_profile_id, image_url')
    .eq('id', ids.items[key])
    .eq('is_reference', false);
  assert.ifError(error);
  return data[0] ?? null;
};

const SKETCH = {
  v: 1, glass: 'coupe', ice: 'none', method: 'stir', liquid: { hex: '#e8dcb0', alpha: 0.6 },
  foam: null, float: null, bleed: null, fizz: false, garnish: null,
  from: { glass: 'rules', ice: 'rules', method: 'rules', liquid: 'rules', garnish: 'data' }, coverage: 1,
};

const setPage = (barId, page) => db.query('UPDATE public.bars SET page_visibility = $2 WHERE id = $1', [barId, page]);

before(async () => {
  await db.connect();
  for (const label of ['stranger', 'admin', 'maker', 'catalogAdmin']) users[label] = await makeUser(label);
  await db.query('INSERT INTO private.app_admins (user_id) VALUES ($1)', [users.catalogAdmin.id]);
  await db.query("INSERT INTO private.age_checks (user_id, country_code, minimum_age, confirmed_at) VALUES ($1, 'AU', 18, now())", [users.stranger.id]);

  // An unclaimed bar (a profile with no venue) and a claimed one.
  ids.unclaimed = (await serviceInsert('profiles', { kind: 'bar', handle: `moth${run}`, display_name: `Pale Moth ${run}`, is_public: true })).id;
  ids.bar = (await serviceInsert('bars', { name: `Little Rye ${run}` })).id;
  ids.claimed = (await serviceInsert('profiles', { kind: 'bar', handle: `rye${run}`, display_name: `Little Rye ${run}`, bar_id: ids.bar, is_public: true })).id;
  ids.person = (await serviceInsert('profiles', { kind: 'person', handle: `sam${run}`, display_name: `Sam ${run}`, is_public: true })).id;
  await serviceInsert('user_bars', { user_id: users.admin.id, bar_id: ids.bar, role_level: 40 });
  await serviceInsert('user_bars', { user_id: users.maker.id, bar_id: ids.bar, role_level: 35 });
  await db.query("UPDATE public.bars SET default_publish_mode = 'spec' WHERE id = $1", [ids.bar]);

  const item = async (row) => (await serviceInsert('items', { item_type: 'cocktail', ...row })).id;
  ids.items.gin = await item({ name: `Gin ${run}`, item_type: 'ingredient' });
  ids.items.shake = await item({ name: `Shake ${run}`, item_type: 'method' });
  // Seeded the way the 50 Best signatures are: shared, credited to the bar.
  ids.items.mothMartini = await item({ name: `Moth Martini ${run}`, description: 'Dry, floral, a little saline.', origin_bar_profile_id: ids.unclaimed, creator_profile_id: ids.person });
  ids.items.ryeSour = await item({ name: `Rye Sour ${run}`, description: 'A soft rye sour.', origin_bar_profile_id: ids.claimed });
  ids.items.classic = await item({ name: `Classic ${run}`, origin_bar_profile_id: ids.unclaimed });
  await db.query('UPDATE public.items SET is_catalog = true WHERE id = $1', [ids.items.classic]);
  // The claimed bar's own venue drink, published with its spec by the bar's default.
  ids.items.house = await item({ name: `House Fizz ${run}`, description: 'Gin and bubbles.', bar_id: ids.bar, creator_profile_id: ids.person });

  for (const key of ['mothMartini', 'ryeSour', 'classic', 'house']) {
    await serviceInsert('recipes', { recipe_item_id: ids.items[key], ingredient_item_id: ids.items.gin, amount: 60, unit: 'ml', sort_order: 0 });
    await serviceInsert('item_methods', { item_id: ids.items[key], method_item_id: ids.items.shake, sort_order: 0 });
  }
});

after(async () => {
  const like = `%${run}%`;
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.profiles WHERE handle LIKE $1', [like]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM private.app_admins WHERE user_id = $1', [users.catalogAdmin?.id]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('an unclaimed bar', () => {
  test('its page reads as names and descriptions, signed out too', async () => {
    const { data, error } = await anon.from('profiles').select('page_visibility').eq('id', ids.unclaimed).single();
    assert.ifError(error);
    assert.equal(data.page_visibility, 'description');
    const person = await anon.from('profiles').select('page_visibility').eq('id', ids.person).single();
    assert.equal(person.data.page_visibility, null);
  });

  test("a signed-in stranger sees the drink's name, description and credit, but no spec rows or method", async () => {
    const row = await users.stranger.client.from('items').select('name, description, origin_bar_profile_id, creator_profile_id').eq('id', ids.items.mothMartini).single();
    assert.ifError(row.error);
    assert.equal(row.data.description, 'Dry, floral, a little saline.');
    assert.equal(row.data.creator_profile_id, ids.person);
    assert.deepEqual(await specRows(users.stranger.client, 'mothMartini'), []);
    assert.deepEqual(await methods(users.stranger.client, 'mothMartini'), []);
    const locked = await users.stranger.client.rpc('is_spec_locked', { p_item_id: ids.items.mothMartini });
    assert.equal(locked.data, true);
  });

  test('signed out sees the same card (name, description, credit, drawing), but no spec rows', async () => {
    assert.deepEqual(await specRows(anon, 'mothMartini'), []);
    const card = await published(anon, 'mothMartini');
    assert.equal(card.name, `Moth Martini ${run}`);
    assert.equal(card.description, 'Dry, floral, a little saline.');
    assert.equal(card.creator_profile_id, ids.person);
    assert.equal(card.publish_mode, 'description');
    assert.ifError((await service.rpc('save_item_sketch', { p_item_id: ids.items.mothMartini, p_inputs: SKETCH, p_source: 'rules', p_spec_fingerprint: 'test', p_rules_version: 1 })).error);
    const { data, error } = await anon.from('item_sketches').select('item_id').eq('item_id', ids.items.mothMartini);
    assert.ifError(error);
    assert.equal(data.length, 1);
  });

  test("signed out, a shared classic's card shows but not its spec", async () => {
    assert.equal((await published(anon, 'classic')).publish_mode, 'description');
    assert.deepEqual(await specRows(anon, 'classic'), []);
  });

  test('a classic credited to the bar keeps its spec', async () => {
    assert.equal((await specRows(users.stranger.client, 'classic')).length, 1);
    assert.equal((await methods(users.stranger.client, 'classic')).length, 1);
    const locked = await users.stranger.client.rpc('is_spec_locked', { p_item_id: ids.items.classic });
    assert.equal(locked.data, false);
  });

  test('catalog admins, who edit these drinks, still see the spec', async () => {
    assert.equal((await specRows(users.catalogAdmin.client, 'mothMartini')).length, 1);
    assert.equal((await methods(users.catalogAdmin.client, 'mothMartini')).length, 1);
  });

  test('a locked drink can still be ranked and collected', async () => {
    const rank = await users.stranger.client
      .from('rank_entries')
      .insert({ item_id: ids.items.mothMartini, ranked_as_item_id: ids.items.mothMartini, venue_profile_id: ids.unclaimed, sentiment: 'loved', rank_key: 0, had_on: '2026-10-07' })
      .select('id')
      .single();
    assert.ifError(rank.error);
    const collect = await users.stranger.client.from('collected_items').insert({ item_id: ids.items.mothMartini }).select('item_id').single();
    assert.ifError(collect.error);
    assert.equal(collect.data.item_id, ids.items.mothMartini);
  });
});

describe('a claimed bar chooses who sees its page', () => {
  test('open (the default once claimed): credited and published specs show as before', async () => {
    const { data } = await anon.from('profiles').select('page_visibility').eq('id', ids.claimed).single();
    assert.equal(data.page_visibility, 'open');
    assert.equal((await specRows(users.stranger.client, 'ryeSour')).length, 1);
    assert.equal((await methods(users.stranger.client, 'ryeSour')).length, 1);
    assert.equal((await published(anon, 'house'))?.publish_mode, 'spec');
    assert.equal((await specRows(anon, 'house')).length, 1);
  });

  test('a Drink Creator cannot change it; an Admin can', async () => {
    const byMaker = await users.maker.client.from('bars').update({ page_visibility: 'locked' }).eq('id', ids.bar).select('id');
    assert.deepEqual(byMaker.data ?? [], []);
    const { rows } = await db.query('SELECT page_visibility FROM public.bars WHERE id = $1', [ids.bar]);
    assert.equal(rows[0].page_visibility, 'open');
    const byAdmin = await users.admin.client.from('bars').update({ page_visibility: 'description' }).eq('id', ids.bar).select('page_visibility');
    assert.ifError(byAdmin.error);
    assert.equal(byAdmin.data[0].page_visibility, 'description');
    // The public page follows the bar, and writing the copy directly changes nothing.
    const profile = await anon.from('profiles').select('page_visibility').eq('id', ids.claimed).single();
    assert.equal(profile.data.page_visibility, 'description');
    await db.query("UPDATE public.profiles SET page_visibility = 'open' WHERE id = $1", [ids.claimed]);
    const { rows: after } = await db.query('SELECT page_visibility FROM public.profiles WHERE id = $1', [ids.claimed]);
    assert.equal(after[0].page_visibility, 'description');
  });

  test('names and descriptions: published drinks drop to the menu card, credited drinks lose their spec', async () => {
    await setPage(ids.bar, 'description');
    const house = await published(anon, 'house');
    assert.equal(house.publish_mode, 'description');
    assert.equal(house.description, 'Gin and bubbles.');
    assert.deepEqual(await specRows(anon, 'house'), []);
    assert.deepEqual(await specRows(users.stranger.client, 'ryeSour'), []);
    assert.deepEqual(await methods(users.stranger.client, 'ryeSour'), []);
  });

  test("the bar's own team still sees everything", async () => {
    await setPage(ids.bar, 'locked');
    assert.equal((await specRows(users.maker.client, 'ryeSour')).length, 1);
    assert.equal((await methods(users.maker.client, 'ryeSour')).length, 1);
    assert.equal((await specRows(users.maker.client, 'house')).length, 1);
    const locked = await users.maker.client.rpc('is_spec_locked', { p_item_id: ids.items.ryeSour });
    assert.equal(locked.data, false);
  });

  test('locked: the public sees the name only, no description, creator, picture or spec', async () => {
    await setPage(ids.bar, 'locked');
    const house = await published(anon, 'house');
    assert.equal(house.name, `House Fizz ${run}`);
    assert.equal(house.description, null);
    assert.equal(house.creator_profile_id, null);
    assert.equal(house.image_url, null);
    assert.deepEqual(await specRows(anon, 'house'), []);
    // A credited drink of a locked page keeps its drawing from the public too.
    assert.ifError((await service.rpc('save_item_sketch', { p_item_id: ids.items.ryeSour, p_inputs: SKETCH, p_source: 'rules', p_spec_fingerprint: 'test', p_rules_version: 1 })).error);
    assert.equal((await published(anon, 'ryeSour')).description, null);
    const sketch = await anon.from('item_sketches').select('item_id').eq('item_id', ids.items.ryeSour);
    assert.ok(sketch.error || sketch.data.length === 0, 'anon reads no drawing');
    assert.deepEqual(await specRows(users.stranger.client, 'ryeSour'), []);
    await setPage(ids.bar, 'open');
  });
});

describe('claiming the page', () => {
  test('once the bar claims it, the page is open and the spec shows', async () => {
    // What approve_profile_claim does for a bar: the profile gets its venue.
    const venue = (await serviceInsert('bars', { name: `Pale Moth venue ${run}` })).id;
    await db.query('UPDATE public.profiles SET bar_id = $2 WHERE id = $1', [ids.unclaimed, venue]);
    const { data } = await anon.from('profiles').select('page_visibility').eq('id', ids.unclaimed).single();
    assert.equal(data.page_visibility, 'open');
    assert.equal((await specRows(users.stranger.client, 'mothMartini')).length, 1);
    assert.equal((await methods(users.stranger.client, 'mothMartini')).length, 1);
  });
});
