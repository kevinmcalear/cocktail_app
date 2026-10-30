// Drink departments and approval (supabase/migrations/20261201100000_drink_departments.sql,
// Eddie's tf-059 and tf-087, jam dec-25). A venue role limited to beer and
// wine adds only those, edits and deletes only those, doesn't see drinks above
// its level just because it edits drinks, and what it adds waits for approval:
// only its maker and someone who edits every kind see it until that person
// approves. A department can't lift its own limit. A batch's method (steps)
// follows its own prep level. Runs through the real API against the local stack.
//
//   supabase start && supabase db reset
//   npm run test:security

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
  throw new Error(`Refusing to run drink department tests against a non-local API: ${status.API_URL}`);
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
  const email = `${label}-${run}@drink-departments-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

async function insert(table, row) {
  const { data, error } = await service.from(table).insert(row).select().single();
  if (error) throw new Error(`fixture insert into ${table} failed: ${error.message}`);
  return data;
}

const sees = async (who, id) => {
  const { data, error } = await users[who].client.from('items').select('id').eq('id', id);
  assert.ifError(error);
  return data.length === 1;
};

before(async () => {
  await db.connect();
  for (const label of ['admin', 'creator', 'bartender', 'beer', 'prep']) users[label] = await makeUser(label);
  // The menu opens at Bartender; one secret drink opens only at Admin.
  ids.bar = (await insert('bars', { name: `Departments bar ${run}`, default_visibility_level: 30 })).id;
  ids.beerRole = (await insert('venue_roles', {
    bar_id: ids.bar, name: `Beer and wine ${run}`, base_level: 30, granted: ['edit_drinks'], drink_types: ['beer', 'wine'],
  })).id;
  await insert('user_bars', { user_id: users.admin.id, bar_id: ids.bar, role_level: 40 });
  await insert('user_bars', { user_id: users.creator.id, bar_id: ids.bar, role_level: 35 });
  await insert('user_bars', { user_id: users.bartender.id, bar_id: ids.bar, role_level: 30 });
  await insert('user_bars', { user_id: users.beer.id, bar_id: ids.bar, role_level: 30, venue_role_id: ids.beerRole });
  await insert('user_bars', { user_id: users.prep.id, bar_id: ids.bar, role_level: 20 });
  await db.query("INSERT INTO public.venue_level_overrides (bar_id, base_level, granted) VALUES ($1, 20, '{prep}')", [ids.bar]);
  ids.cocktail = (await insert('items', { name: `House Martini ${run}`, item_type: 'cocktail', bar_id: ids.bar })).id;
  ids.secret = (await insert('items', { name: `Secret ${run}`, item_type: 'cocktail', bar_id: ids.bar, override_visibility_level: 40 })).id;
  ids.secretBeer = (await insert('items', { name: `Secret lager ${run}`, item_type: 'beer', bar_id: ids.bar, override_visibility_level: 40 })).id;
  ids.wine = (await insert('items', { name: `House red ${run}`, item_type: 'wine', bar_id: ids.bar })).id;
  // Prep staff see the batch itself (it opens at Employee); its method opens at Drink Creator.
  ids.batch = (await insert('items', {
    name: `Oleo ${run}`, item_type: 'ingredient', bar_id: ids.bar, override_visibility_level: 20, override_prep_level: 35,
  })).id;
  await db.query("INSERT INTO public.item_steps (item_id, position, body) VALUES ($1, 0, 'Muddle the peels.')", [ids.batch]);
  // Drinks credited to the venue: no bar_id, edited through the venue's page.
  ids.profile = (await insert('profiles', { kind: 'bar', handle: `departments${run}`, display_name: `Departments ${run}`, bar_id: ids.bar, is_public: true })).id;
  ids.creditedCocktail = (await insert('items', { name: `Credited Sour ${run}`, item_type: 'cocktail', origin_bar_profile_id: ids.profile })).id;
  ids.creditedBeer = (await insert('items', { name: `Credited Lager ${run}`, item_type: 'beer', origin_bar_profile_id: ids.profile })).id;
});

/** private.can_view_bar_item as someone (events and This week ask it). */
async function viewsBarItem(who, level) {
  await db.query('BEGIN');
  try {
    await db.query('SET LOCAL ROLE authenticated');
    await db.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: users[who].id, role: 'authenticated' })]);
    const { rows } = await db.query('SELECT private.can_view_bar_item($1, $2) AS ok', [ids.bar, level]);
    return rows[0].ok;
  } finally {
    await db.query('ROLLBACK');
  }
}

after(async () => {
  if (ids.bar) await db.query('DELETE FROM public.items WHERE bar_id = $1', [ids.bar]);
  if (ids.profile) await db.query('DELETE FROM public.items WHERE origin_bar_profile_id = $1', [ids.profile]);
  if (ids.profile) await service.from('profiles').delete().eq('id', ids.profile);
  if (ids.bar) await service.from('bars').delete().eq('id', ids.bar);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
  await db.end();
});

describe('a beer and wine role', () => {
  test('adds a beer, which waits for approval whatever it sends', async () => {
    const { data, error } = await users.beer.client.from('items')
      .insert({ name: `Pilsner ${run}`, item_type: 'beer', bar_id: ids.bar, created_by: users.beer.id, awaiting_approval: false })
      .select('id, awaiting_approval').single();
    assert.ifError(error);
    assert.equal(data.awaiting_approval, true);
    ids.pils = data.id;
  });

  test("can't add a cocktail or a house-made ingredient", async () => {
    for (const item_type of ['cocktail', 'ingredient']) {
      const { error } = await users.beer.client.from('items').insert({ name: `Nope ${run}`, item_type, bar_id: ids.bar, created_by: users.beer.id });
      assert.ok(error, `${item_type} refused`);
    }
  });

  test('edits a wine, not a cocktail, and never turns one into the other', async () => {
    const wine = await users.beer.client.from('items').update({ description: 'Juicy.' }).eq('id', ids.wine).select('id');
    assert.equal(wine.data?.length, 1);
    const cocktail = await users.beer.client.from('items').update({ description: 'Mine now.' }).eq('id', ids.cocktail).select('id');
    assert.equal(cocktail.data?.length ?? 0, 0);
    const moved = await users.beer.client.from('items').update({ item_type: 'cocktail' }).eq('id', ids.wine).select('id');
    assert.ok(moved.error);
    const { data } = await users.beer.client.rpc('can_edit_item', { p_item_id: ids.cocktail });
    assert.equal(data, false);
  });

  test("can't delete a cocktail", async () => {
    await users.beer.client.from('items').delete().eq('id', ids.cocktail);
    const { rows } = await db.query('SELECT 1 FROM public.items WHERE id = $1', [ids.cocktail]);
    assert.equal(rows.length, 1);
  });

  test('sees by its level, plus its own kinds; a Drink Creator still sees everything', async () => {
    assert.equal(await sees('beer', ids.cocktail), true);
    assert.equal(await sees('beer', ids.secret), false);
    assert.equal(await sees('beer', ids.secretBeer), true);
    assert.equal(await sees('creator', ids.secret), true);
  });

  test("events and This week don't show it drinks above its level (can_view_bar_item)", async () => {
    assert.equal(await viewsBarItem('beer', 40), false);
    assert.equal(await viewsBarItem('beer', 30), true);
    assert.equal(await viewsBarItem('creator', 40), true);
  });

  test("edits a beer credited to the venue, not a credited cocktail; a Drink Creator edits both", async () => {
    const beer = await users.beer.client.from('items').update({ description: 'Crisp.' }).eq('id', ids.creditedBeer).select('id');
    assert.ifError(beer.error);
    assert.equal(beer.data?.length, 1);
    const cocktail = await users.beer.client.from('items').update({ description: 'Mine now.' }).eq('id', ids.creditedCocktail).select('id');
    assert.equal(cocktail.data?.length ?? 0, 0);
    const { data: canEdit } = await users.beer.client.rpc('can_edit_item', { p_item_id: ids.creditedCocktail });
    assert.equal(canEdit, false);
    const { rows } = await db.query('SELECT description FROM public.items WHERE id = $1', [ids.creditedCocktail]);
    assert.notEqual(rows[0].description, 'Mine now.');
    const creator = await users.creator.client.from('items').update({ description: 'Shaken hard.' }).eq('id', ids.creditedCocktail).select('id');
    assert.equal(creator.data?.length, 1);
  });

  test("can't approve its own drink or lift its own limit", async () => {
    const approve = await users.beer.client.from('items').update({ awaiting_approval: false }).eq('id', ids.pils);
    assert.ok(approve.error);
    const lift = await users.beer.client.from('venue_roles').update({ drink_types: null }).eq('id', ids.beerRole);
    assert.ok(lift.error || !(await db.query('SELECT 1 FROM public.venue_roles WHERE id = $1 AND drink_types IS NULL', [ids.beerRole])).rows.length);
    const { data } = await users.beer.client.rpc('my_drink_types', { p_bar_id: ids.bar });
    assert.deepEqual(data, ['beer', 'wine']);
  });

  test("with staff, still can't widen its own role (permissions or level)", async () => {
    await db.query("UPDATE public.venue_roles SET granted = '{edit_drinks,staff}' WHERE id = $1", [ids.beerRole]);
    try {
      const menu = await users.beer.client.from('venue_roles').update({ granted: ['edit_drinks', 'staff', 'menu'] }).eq('id', ids.beerRole).select('id');
      assert.ok(menu.error, 'granting menu refused');
      const level = await users.beer.client.from('venue_roles').update({ base_level: 35 }).eq('id', ids.beerRole).select('id');
      assert.ok(level.error, 'raising the level refused');
      const { rows } = await db.query('SELECT granted::text[] AS granted, base_level FROM public.venue_roles WHERE id = $1', [ids.beerRole]);
      assert.deepEqual(rows[0], { granted: ['edit_drinks', 'staff'], base_level: 30 });
    } finally {
      await db.query("UPDATE public.venue_roles SET granted = '{edit_drinks}' WHERE id = $1", [ids.beerRole]);
    }
  });
});

describe('approval', () => {
  test('a waiting drink is for its maker and approvers only', async () => {
    assert.equal(await sees('beer', ids.pils), true);
    assert.equal(await sees('creator', ids.pils), true);
    assert.equal(await sees('admin', ids.pils), true);
    assert.equal(await sees('bartender', ids.pils), false);
  });

  test('a waiting drink is never public, even when the venue publishes by default', async () => {
    await db.query("UPDATE public.bars SET default_publish_mode = 'description' WHERE id = $1", [ids.bar]);
    const listed = async () => {
      const { data, error } = await anon.from('published_items').select('id').in('id', [ids.pils, ids.wine]);
      assert.ifError(error);
      return data.map((r) => r.id);
    };
    const now = await listed();
    assert.ok(now.includes(ids.wine), 'an approved drink is listed');
    assert.ok(!now.includes(ids.pils), 'the waiting one is not');
    // Nor its child rows: can_view_item's published_items branch says no for a bartender.
    const { rows } = await db.query('SELECT count(*)::int AS n FROM public.published_items WHERE id = $1', [ids.pils]);
    assert.equal(rows[0].n, 0);
  });

  test('a bartender (no edit_drinks) cannot approve; a Drink Creator can', async () => {
    const no = await users.bartender.client.from('items').update({ awaiting_approval: false }).eq('id', ids.pils).select('id');
    assert.equal(no.data?.length ?? 0, 0);
    const yes = await users.creator.client.from('items').update({ awaiting_approval: false }).eq('id', ids.pils).select('awaiting_approval').single();
    assert.ifError(yes.error);
    assert.equal(yes.data.awaiting_approval, false);
    assert.equal(await sees('bartender', ids.pils), true);
    const { data } = await anon.from('published_items').select('id').eq('id', ids.pils);
    assert.equal(data?.length, 1, 'approved, it lists like any other');
  });

  test("an unlimited member's drinks never wait", async () => {
    const { data, error } = await users.creator.client.from('items')
      .insert({ name: `Gimlet ${run}`, item_type: 'cocktail', bar_id: ids.bar, created_by: users.creator.id })
      .select('awaiting_approval').single();
    assert.ifError(error);
    assert.equal(data.awaiting_approval, false);
  });

  test('the Roles screen reads drink types', async () => {
    const { data, error } = await users.admin.client.rpc('get_venue_role_matrix', { p_bar_id: ids.bar });
    assert.ifError(error);
    assert.deepEqual(data.find((r) => r.role_id === ids.beerRole).drink_types, ['beer', 'wine']);
    assert.equal(data.find((r) => r.role_id === null && r.base_level === 35).drink_types, null);
  });
});

test("a batch's method follows its prep level (tf-087)", async () => {
  const steps = async (who) => (await users[who].client.from('item_steps').select('body').eq('item_id', ids.batch)).data ?? [];
  // Prep at Employee sees the batch, but the method opens at Drink Creator.
  assert.equal(await sees('prep', ids.batch), true);
  assert.equal((await steps('prep')).length, 0);
  assert.equal((await steps('creator')).length, 1);
  const { error } = await service.from('items').update({ override_prep_level: null }).eq('id', ids.batch);
  assert.ifError(error);
  assert.equal((await steps('prep')).length, 1);
});
