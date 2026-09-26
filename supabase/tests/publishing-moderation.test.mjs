// Row-level security and behaviour tests for the publishing and moderation
// draft migrations (docs/publishing_moderation_proposal.md): publish modes,
// releases, the public projection, collections, home menus, the age check,
// blocks and reports. Runs through the real API as real users, and signed
// out.
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
  throw new Error(`Refusing to run publishing tests against a non-local API: ${status.API_URL}`);
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

async function ids_of(query) {
  const { data, error } = await query;
  assert.ifError(error);
  return new Set(data.map((r) => r.id));
}

// The published drinks and references a caller sees among this run's items.
const publishedIds = (client) =>
  ids_of(client.from('published_items').select('id').in('id', Object.values(ids.items)));

const recipeRows = async (client, drinkId) => {
  const { data, error } = await client
    .from('app_recipe_presentation')
    .select('display_ingredient_id, amount, unit, preparation_notes, ingredient_item_id')
    .eq('recipe_item_id', drinkId)
    .order('sort_order');
  assert.ifError(error);
  return data;
};

const years = (n) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return d.toISOString().slice(0, 10);
};

before(async () => {
  await db.connect();

  for (const label of [
    'admin', 'maker', 'guest', 'otherAdmin', 'homeUser', 'stranger', 'noAgeCheck', 'minor', 'moderator',
  ]) {
    users[label] = await makeUser(label);
  }
  await db.query('INSERT INTO private.app_admins (user_id) VALUES ($1)', [users.moderator.id]);

  ids.barOne = (await serviceInsert('bars', { name: `Little Rye ${run}` })).id;
  ids.barTwo = (await serviceInsert('bars', { name: `Pale Moth ${run}` })).id;
  for (const [label, bar, role] of [
    ['admin', ids.barOne, 40],
    ['maker', ids.barOne, 35],
    ['guest', ids.barOne, 10],
    ['otherAdmin', ids.barTwo, 40],
  ]) {
    await serviceInsert('user_bars', { user_id: users[label].id, bar_id: bar, role_level: role });
  }

  ids.barOneProfile = (
    await serviceInsert('profiles', { kind: 'bar', handle: `rye${run}`, display_name: `Little Rye ${run}`, bar_id: ids.barOne, is_public: true })
  ).id;
  // Pale Moth has a profile, but it isn't public yet.
  await serviceInsert('profiles', { kind: 'bar', handle: `moth${run}`, display_name: `Pale Moth ${run}`, bar_id: ids.barTwo, is_public: false });
  ids.homeProfile = (
    await serviceInsert('profiles', { kind: 'person', handle: `jo${run}`, display_name: 'Jo', user_id: users.homeUser.id, is_public: true })
  ).id;
  ids.strangerProfile = (
    await serviceInsert('profiles', { kind: 'person', handle: `ash${run}`, display_name: 'Ash', user_id: users.stranger.id, is_public: true })
  ).id;

  const item = async (row) => (await serviceInsert('items', row)).id;
  ids.items = {};
  ids.items.rocks = await item({ name: `Rocks ${run}`, item_type: 'glassware', created_by: null });
  ids.items.scotch = await item({ name: `Blended Scotch ${run}`, item_type: 'ingredient', created_by: null });
  ids.items.monkey = await item({ name: `Brand Scotch ${run}`, item_type: 'ingredient', created_by: null });
  ids.items.syrup = await item({
    name: `Honey-ginger syrup ${run}`, item_type: 'ingredient', bar_id: ids.barOne, description: 'Secret house syrup',
  });
  // Full spec, with a bartender note that must never reach the public.
  ids.items.penicillin = await item({
    name: `Penicillin ${run}`, item_type: 'cocktail', bar_id: ids.barOne, glassware_id: ids.items.rocks,
    description: 'Scotch, honey, ginger, lemon.', notes: 'Bartender note: float the Islay last.', price: '22',
    publish_mode: 'spec',
  });
  // Menu description only.
  ids.items.goldRush = await item({
    name: `Gold Rush ${run}`, item_type: 'cocktail', bar_id: ids.barOne, description: 'Bourbon, honey, lemon.',
    notes: 'Bartender note: 30 ml honey.', publish_mode: 'description',
  });
  // Private, on the Guest menu (visibility 10).
  ids.items.houseSour = await item({ name: `House Sour ${run}`, item_type: 'cocktail', bar_id: ids.barOne });
  // Private, staff only.
  ids.items.staffDrink = await item({
    name: `Staff Drink ${run}`, item_type: 'cocktail', bar_id: ids.barOne, override_visibility_level: 30,
  });
  // A home bartender's own riff, published.
  ids.items.riff = await item({
    name: `Smoked Pear Penicillin ${run}`, item_type: 'cocktail', created_by: users.homeUser.id,
    description: 'A kitchen riff.', publish_mode: 'description',
  });
  // The stranger's own riff, published.
  ids.items.strangerRiff = await item({
    name: `Ash Riff ${run}`, item_type: 'cocktail', created_by: users.stranger.id, publish_mode: 'description',
  });

  for (const [drink, rows] of [
    ['penicillin', [
      { ingredient_item_id: ids.items.monkey, parent_ingredient_id: ids.items.scotch, amount: 60, unit: 'ml', preparation_notes: 'Chilled' },
      { ingredient_item_id: ids.items.syrup, amount: 22.5, unit: 'ml' },
    ]],
    ['goldRush', [{ ingredient_item_id: ids.items.syrup, amount: 30, unit: 'ml' }]],
    ['houseSour', [{ ingredient_item_id: ids.items.syrup, amount: 15, unit: 'ml' }]],
  ]) {
    for (const [sort_order, row] of rows.entries()) {
      await serviceInsert('recipes', { recipe_item_id: ids.items[drink], sort_order, ...row });
    }
  }

  ids.release = (
    await serviceInsert('releases', { bar_id: ids.barOne, name: `Autumn release ${run}`, release_date: '2026-03-01' })
  ).id;
  for (const [sort_order, key] of ['penicillin', 'goldRush'].entries()) {
    await serviceInsert('release_items', { release_id: ids.release, bar_id: ids.barOne, item_id: ids.items[key], sort_order });
  }

  for (const label of ['homeUser', 'stranger', 'guest']) {
    const { error } = await users[label].client.rpc('confirm_age', { p_birth_date: years(30), p_country_code: 'AU' });
    if (error) throw error;
  }
});

after(async () => {
  const like = `%${run}%`;
  await db.query('DELETE FROM public.reports WHERE reporter_id = ANY($1)', [Object.values(users).map((u) => u.id)]);
  await db.query('DELETE FROM public.menus WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.releases WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.profiles WHERE handle LIKE $1', [like]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('published drinks', () => {
  test('signed-out visitors see published drinks and what they reference, nothing private', async () => {
    const seen = await publishedIds(anon);
    for (const key of ['penicillin', 'goldRush', 'riff', 'strangerRiff', 'rocks', 'scotch', 'syrup']) {
      assert.ok(seen.has(ids.items[key]), `${key} should be public`);
    }
    for (const key of ['houseSour', 'staffDrink', 'monkey']) {
      assert.ok(!seen.has(ids.items[key]), `${key} should not be public`);
    }
  });

  test('the public projection never carries notes, price or role overrides', async () => {
    const { data, error } = await anon.from('published_items').select('*').eq('id', ids.items.penicillin).single();
    assert.ifError(error);
    for (const column of ['notes', 'price', 'status', 'override_visibility_level', 'created_by', 'moderated_at']) {
      assert.ok(!(column in data), `${column} leaked`);
    }
    assert.equal(data.description, 'Scotch, honey, ginger, lemon.');
    assert.equal(data.glassware_id, ids.items.rocks);
    assert.equal(data.is_reference, false);
    assert.ok((await anon.from('published_items').select('notes').eq('id', ids.items.penicillin)).error);
  });

  test('a referenced house-made ingredient shows its name only', async () => {
    const { data, error } = await anon.from('published_items').select('*').eq('id', ids.items.syrup).single();
    assert.ifError(error);
    assert.equal(data.is_reference, true);
    assert.equal(data.name, `Honey-ginger syrup ${run}`);
    assert.equal(data.description, null);
    assert.equal(data.bar_id, null);
  });

  test('signed-out visitors still read no items rows directly', async () => {
    assert.equal((await ids_of(anon.from('items').select('id').in('id', Object.values(ids.items)))).size, 0);
  });

  test('a signed-in stranger sees the public projection, not the raw row with its notes', async () => {
    const client = users.homeUser.client;
    const raw = await ids_of(client.from('items').select('id').in('id', [ids.items.penicillin, ids.items.goldRush]));
    assert.equal(raw.size, 0);
    const seen = await publishedIds(client);
    assert.ok(seen.has(ids.items.penicillin) && seen.has(ids.items.goldRush));
    assert.ok(!seen.has(ids.items.houseSour) && !seen.has(ids.items.staffDrink));
  });

  test('a Guest sees their menu as before, and staff-only drinks stay hidden everywhere', async () => {
    const client = users.guest.client;
    const raw = await ids_of(client.from('items').select('id').in('id', [ids.items.houseSour, ids.items.staffDrink]));
    assert.deepEqual([...raw], [ids.items.houseSour]);
    const seen = await publishedIds(client);
    assert.ok(!seen.has(ids.items.houseSour) && !seen.has(ids.items.staffDrink));
  });
});

describe('specs through app_recipe_presentation', () => {
  test('a full-spec drink shows amounts and generic ingredients to signed-out visitors', async () => {
    const rows = await recipeRows(anon, ids.items.penicillin);
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0], {
      display_ingredient_id: ids.items.scotch, amount: 60, unit: 'ml', preparation_notes: null, ingredient_item_id: null,
    });
    assert.equal(rows[1].display_ingredient_id, ids.items.syrup);
    assert.equal(rows[1].amount, 22.5);
  });

  test('the spec names its ingredients through published_ingredient', async () => {
    const { data, error } = await anon
      .from('app_recipe_presentation')
      .select('amount, ingredient:published_ingredient(name)')
      .eq('recipe_item_id', ids.items.penicillin)
      .order('sort_order');
    assert.ifError(error);
    assert.deepEqual(data.map((r) => r.ingredient?.name), [`Blended Scotch ${run}`, `Honey-ginger syrup ${run}`]);
  });

  test('a description-only drink returns no spec rows to anyone outside the bar', async () => {
    assert.deepEqual(await recipeRows(anon, ids.items.goldRush), []);
    assert.deepEqual(await recipeRows(users.homeUser.client, ids.items.goldRush), []);
    assert.deepEqual(await recipeRows(users.otherAdmin.client, ids.items.goldRush), []);
  });

  test('a Guest gets the rows of a description-only drink with the spec masked, as before', async () => {
    const rows = await recipeRows(users.guest.client, ids.items.goldRush);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].amount, null);
    assert.equal(rows[0].unit, null);
    assert.equal(rows[0].display_ingredient_id, null);
  });

  test('a Guest gets at least the public spec of a full-spec drink', async () => {
    const rows = await recipeRows(users.guest.client, ids.items.penicillin);
    assert.equal(rows[0].amount, 60);
    assert.equal(rows[0].display_ingredient_id, ids.items.scotch);
    assert.equal(rows[0].ingredient_item_id, null);
  });

  test('members above the public level still see the brand and prep notes', async () => {
    const rows = await recipeRows(users.admin.client, ids.items.penicillin);
    assert.equal(rows[0].ingredient_item_id, ids.items.monkey);
    assert.equal(rows[0].preparation_notes, 'Chilled');
  });

  test('private drinks stay out of the view for non-members', async () => {
    assert.deepEqual(await recipeRows(anon, ids.items.houseSour), []);
    assert.deepEqual(await recipeRows(users.homeUser.client, ids.items.houseSour), []);
  });
});

describe('who can publish', () => {
  test('a Drink Creator can edit a drink but not publish it', async () => {
    const client = users.maker.client;
    const edit = await client.from('items').update({ description: 'Tart.' }).eq('id', ids.items.houseSour).select('id');
    assert.ifError(edit.error);
    assert.equal(edit.data.length, 1);
    const { error } = await client.from('items').update({ publish_mode: 'description' }).eq('id', ids.items.houseSour);
    assert.match(error?.message ?? '', /publish permission/);
  });

  test('an admin publishes and unpublishes, and published_at follows', async () => {
    const client = users.admin.client;
    let res = await client.from('items').update({ publish_mode: 'description' }).eq('id', ids.items.houseSour).select('published_at').single();
    assert.ifError(res.error);
    assert.ok(res.data.published_at);
    assert.ok((await publishedIds(anon)).has(ids.items.houseSour));
    res = await client.from('items').update({ publish_mode: 'private' }).eq('id', ids.items.houseSour).select('published_at').single();
    assert.ifError(res.error);
    assert.equal(res.data.published_at, null);
    assert.ok(!(await publishedIds(anon)).has(ids.items.houseSour));
  });

  test('a bar without a public profile can\'t publish', async () => {
    const created = await users.otherAdmin.client
      .from('items')
      .insert({ name: `Moth Colada ${run}`, item_type: 'cocktail', bar_id: ids.barTwo, created_by: users.otherAdmin.id, publish_mode: 'spec' });
    assert.match(created.error?.message ?? '', /public profile/);
  });

  test('a person publishes their own drink only with a public profile', async () => {
    const client = users.noAgeCheck.client;
    const { error } = await client
      .from('items')
      .insert({ name: `Private riff ${run}`, item_type: 'cocktail', created_by: users.noAgeCheck.id, publish_mode: 'description' });
    assert.match(error?.message ?? '', /public profile/);
  });

  test('only moderators set a moderation hold', async () => {
    const { error } = await users.admin.client.from('items').update({ moderated_at: new Date().toISOString() }).eq('id', ids.items.penicillin);
    assert.match(error?.message ?? '', /moderators/);
  });
});

describe('releases', () => {
  test('a draft release is invisible outside the bar\'s publishers', async () => {
    assert.equal((await ids_of(anon.from('releases').select('id').eq('id', ids.release))).size, 0);
    assert.equal((await ids_of(users.guest.client.from('releases').select('id').eq('id', ids.release))).size, 0);
    assert.equal((await ids_of(users.admin.client.from('releases').select('id').eq('id', ids.release))).size, 1);
  });

  test('a release with a private drink in it can\'t be published', async () => {
    const client = users.admin.client;
    const add = await client
      .from('release_items')
      .insert({ release_id: ids.release, bar_id: ids.barOne, item_id: ids.items.houseSour, sort_order: 9 });
    assert.ifError(add.error);
    const { error } = await client.from('releases').update({ published_at: new Date().toISOString() }).eq('id', ids.release);
    assert.match(error?.message ?? '', /must be published/);
    await client.from('release_items').delete().eq('release_id', ids.release).eq('item_id', ids.items.houseSour);
  });

  test('a Drink Creator can\'t publish a release', async () => {
    const { data } = await users.maker.client
      .from('releases')
      .update({ published_at: new Date().toISOString() })
      .eq('id', ids.release)
      .select('id');
    assert.deepEqual(data, []);
  });

  test('once published, the release and its drink list are public', async () => {
    const { error } = await users.admin.client.from('releases').update({ published_at: new Date(Date.now() - 1000).toISOString() }).eq('id', ids.release);
    assert.ifError(error);
    assert.equal((await ids_of(anon.from('releases').select('id').eq('id', ids.release))).size, 1);
    const { data } = await anon.from('release_items').select('item_id').eq('release_id', ids.release).order('sort_order');
    assert.deepEqual(data.map((r) => r.item_id), [ids.items.penicillin, ids.items.goldRush]);
  });

  test('a private drink can\'t be added to a published release', async () => {
    const { error } = await users.admin.client
      .from('release_items')
      .insert({ release_id: ids.release, bar_id: ids.barOne, item_id: ids.items.houseSour });
    assert.match(error?.message ?? '', /Publish the drink/);
  });

  test('a scheduled release stays hidden until its time', async () => {
    const future = await serviceInsert('releases', {
      bar_id: ids.barOne, name: `Winter release ${run}`, release_date: '2026-06-01',
    });
    await serviceInsert('release_items', { release_id: future.id, bar_id: ids.barOne, item_id: ids.items.penicillin });
    const { error } = await users.admin.client
      .from('releases')
      .update({ published_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString() })
      .eq('id', future.id);
    assert.ifError(error);
    assert.equal((await ids_of(anon.from('releases').select('id').eq('id', future.id))).size, 0);
  });

  test('a release can only hold its own bar\'s drinks', async () => {
    const { error } = await users.admin.client
      .from('release_items')
      .insert({ release_id: ids.release, bar_id: ids.barOne, item_id: ids.items.riff });
    assert.ok(error);
  });
});

describe('age check', () => {
  test('under age for the country: refused, and a second try with another date fails too', async () => {
    const client = users.minor.client;
    const first = await client.rpc('confirm_age', { p_birth_date: years(19), p_country_code: 'US' });
    assert.ifError(first.error);
    assert.equal(first.data, null);
    assert.equal((await client.rpc('get_my_age_check')).data, 'under_age');
    const retry = await client.rpc('confirm_age', { p_birth_date: years(40), p_country_code: 'US' });
    assert.ok(retry.error);
    assert.equal((await client.rpc('get_my_age_check')).data, 'under_age');
  });

  test('of age: confirmed with the country\'s drinking age, and no birth date kept', async () => {
    assert.equal((await users.homeUser.client.rpc('get_my_age_check')).data, 'confirmed');
    const { rows } = await db.query('SELECT * FROM private.age_checks WHERE user_id = $1', [users.homeUser.id]);
    assert.equal(rows[0].minimum_age, 18);
    assert.ok(!Object.keys(rows[0]).some((k) => k.includes('birth')));
  });

  test('signed-out callers can\'t use it', async () => {
    assert.ok((await anon.rpc('confirm_age', { p_birth_date: years(30), p_country_code: 'AU' })).error);
  });
});

describe('collections and home menus', () => {
  test('collecting needs a confirmed age', async () => {
    const { error } = await users.noAgeCheck.client.from('collected_releases').insert({ release_id: ids.release });
    assert.ok(error);
    const under = await users.minor.client.from('collected_items').insert({ item_id: ids.items.penicillin });
    assert.ok(under.error);
  });

  test('a home user collects a live release and a published drink', async () => {
    const client = users.homeUser.client;
    assert.ifError((await client.from('collected_releases').insert({ release_id: ids.release })).error);
    assert.ifError((await client.from('collected_items').insert({ item_id: ids.items.penicillin, release_id: ids.release })).error);
    const { data } = await client.from('collected_items').select('item_id');
    assert.deepEqual(data.map((r) => r.item_id), [ids.items.penicillin]);
  });

  test('private drinks and references can\'t be collected', async () => {
    const client = users.homeUser.client;
    for (const key of ['staffDrink', 'houseSour', 'syrup']) {
      assert.ok((await client.from('collected_items').insert({ item_id: ids.items[key] })).error, key);
    }
  });

  test('collections are private to their owner', async () => {
    for (const client of [users.stranger.client, users.admin.client, anon]) {
      const items = await client.from('collected_items').select('item_id').eq('user_id', users.homeUser.id);
      assert.ok(!items.data || items.data.length === 0);
      const releases = await client.from('collected_releases').select('release_id').eq('user_id', users.homeUser.id);
      assert.ok(!releases.data || releases.data.length === 0);
    }
    const { data } = await users.stranger.client
      .from('collected_items')
      .insert({ user_id: users.homeUser.id, item_id: ids.items.goldRush })
      .select();
    assert.ok(!data);
  });

  test('a home menu is a bar-less menu only its creator can read', async () => {
    const client = users.homeUser.client;
    const { data: menu, error } = await client
      .from('menus')
      .insert({ name: `Saturday at home ${run}`, created_by: users.homeUser.id, menu_date: '2026-09-27', guest_count: 6 })
      .select()
      .single();
    assert.ifError(error);
    assert.ifError((await client.from('menu_drinks').insert({ menu_id: menu.id, item_id: ids.items.penicillin })).error);

    assert.equal((await ids_of(client.from('menus').select('id').eq('id', menu.id))).size, 1);
    for (const other of [users.stranger.client, users.admin.client, anon]) {
      assert.equal((await ids_of(other.from('menus').select('id').eq('id', menu.id))).size, 0);
      const { data } = await other.from('menu_drinks').select('id').eq('menu_id', menu.id);
      assert.ok(!data || data.length === 0);
    }
  });
});

describe('blocks', () => {
  test('blocking hides the other person\'s profile and published drinks, both ways', async () => {
    const stranger = users.stranger.client;
    assert.ifError((await stranger.from('user_blocks').insert({ blocked_id: users.homeUser.id })).error);

    const strangerSees = await publishedIds(stranger);
    assert.ok(!strangerSees.has(ids.items.riff));
    assert.equal((await ids_of(stranger.from('profiles').select('id').eq('id', ids.homeProfile))).size, 0);

    const homeSees = await publishedIds(users.homeUser.client);
    assert.ok(!homeSees.has(ids.items.strangerRiff));
    assert.equal((await ids_of(users.homeUser.client.from('profiles').select('id').eq('id', ids.strangerProfile))).size, 0);

    // Bars' drinks aren't a person's content, and bystanders are unaffected.
    assert.ok(strangerSees.has(ids.items.penicillin));
    assert.ok((await publishedIds(anon)).has(ids.items.riff));
    assert.equal((await ids_of(users.guest.client.from('profiles').select('id').eq('id', ids.homeProfile))).size, 1);
  });

  test('the blocked person can\'t read the block', async () => {
    const { data } = await users.homeUser.client.from('user_blocks').select('*');
    assert.deepEqual(data, []);
    const mine = await users.stranger.client.from('user_blocks').select('blocked_id');
    assert.deepEqual(mine.data, [{ blocked_id: users.homeUser.id }]);
  });

  test('a block can\'t be made in someone else\'s name', async () => {
    const { error } = await users.guest.client.from('user_blocks').insert({ blocker_id: users.homeUser.id, blocked_id: users.stranger.id });
    assert.ok(error);
  });

  test('a blocked person can still be reported by the one who blocked them', async () => {
    const { error } = await users.stranger.client
      .from('reports')
      .insert({ target_kind: 'profile', profile_id: ids.homeProfile, reason: 'harassment', details: 'Sent me abuse.' });
    assert.ifError(error);
  });

  test('unblocking brings everything back', async () => {
    const stranger = users.stranger.client;
    assert.ifError((await stranger.from('user_blocks').delete().eq('blocked_id', users.homeUser.id)).error);
    assert.ok((await publishedIds(stranger)).has(ids.items.riff));
    assert.equal((await ids_of(stranger.from('profiles').select('id').eq('id', ids.homeProfile))).size, 1);
  });
});

describe('reports', () => {
  test('reports are readable only by the reporter and moderators', async () => {
    const { data: own } = await users.stranger.client.from('reports').select('id, status').eq('profile_id', ids.homeProfile);
    assert.equal(own.length, 1);
    assert.equal(own[0].status, 'open');
    ids.report = own[0].id;
    for (const client of [users.homeUser.client, users.guest.client, users.admin.client, anon]) {
      const { data } = await client.from('reports').select('id').eq('id', ids.report);
      assert.ok(!data || data.length === 0);
    }
    assert.equal((await ids_of(users.moderator.client.from('reports').select('id').eq('id', ids.report))).size, 1);
  });

  test('a second open report on the same target is refused', async () => {
    const { error } = await users.stranger.client
      .from('reports')
      .insert({ target_kind: 'profile', profile_id: ids.homeProfile, reason: 'spam' });
    assert.ok(error);
  });

  test('reporters can\'t change or resolve their report', async () => {
    const client = users.stranger.client;
    const { data } = await client.from('reports').update({ status: 'actioned' }).eq('id', ids.report).select('id');
    assert.deepEqual(data, []);
    assert.ok((await client.rpc('resolve_report', { p_report_id: ids.report, p_status: 'dismissed' })).error);
    assert.ok((await client.rpc('set_content_hidden', { p_kind: 'profile', p_id: ids.homeProfile, p_hidden: true })).error);
  });

  test('you can\'t report what you can\'t see, or file an already-resolved report', async () => {
    const client = users.homeUser.client;
    assert.ok((await client.from('reports').insert({ target_kind: 'item', item_id: ids.items.staffDrink, reason: 'spam' })).error);
    assert.ok((await client.from('reports').insert({ target_kind: 'item', item_id: ids.items.penicillin, reason: 'spam', status: 'dismissed' })).error);
    assert.ok((await client.from('reports').insert({ target_kind: 'profile', item_id: ids.items.penicillin, reason: 'spam' })).error);
  });

  test('a home user reports a published drink and a bar\'s ranking', async () => {
    const client = users.homeUser.client;
    assert.ifError((await client.from('reports').insert({ target_kind: 'item', item_id: ids.items.goldRush, reason: 'misleading' })).error);
    assert.ifError((await client.from('reports').insert({
      target_kind: 'ranking', item_id: ids.items.penicillin, profile_id: ids.barOneProfile, reason: 'fake_rankings',
    })).error);
  });

  test('a moderator resolves with a takedown, and the profile and its drinks leave the public layer', async () => {
    const { data, error } = await users.moderator.client.rpc('resolve_report', {
      p_report_id: ids.report, p_status: 'actioned', p_resolution: 'Profile hidden.', p_hide: true,
    });
    assert.ifError(error);
    assert.equal(data.status, 'actioned');
    assert.equal((await ids_of(anon.from('profiles').select('id').eq('id', ids.homeProfile))).size, 0);
    assert.ok(!(await publishedIds(anon)).has(ids.items.riff));

    // The owner still sees their own profile, and can't lift the hold.
    const own = users.homeUser.client;
    assert.equal((await ids_of(own.from('profiles').select('id').eq('id', ids.homeProfile))).size, 1);
    const { error: undo } = await own.from('profiles').update({ moderated_at: null }).eq('id', ids.homeProfile);
    assert.match(undo?.message ?? '', /moderators/);

    // The reporter sees the outcome.
    const { data: mine } = await users.stranger.client.from('reports').select('status, resolution').eq('id', ids.report).single();
    assert.deepEqual(mine, { status: 'actioned', resolution: 'Profile hidden.' });
  });

  test('a moderator hides a drink and a release, and restores them', async () => {
    const mod = users.moderator.client;
    assert.ifError((await mod.rpc('set_content_hidden', { p_kind: 'item', p_id: ids.items.penicillin, p_hidden: true })).error);
    assert.ifError((await mod.rpc('set_content_hidden', { p_kind: 'release', p_id: ids.release, p_hidden: true })).error);
    assert.ok(!(await publishedIds(anon)).has(ids.items.penicillin));
    assert.deepEqual(await recipeRows(anon, ids.items.penicillin), []);
    assert.equal((await ids_of(anon.from('releases').select('id').eq('id', ids.release))).size, 0);

    assert.ifError((await mod.rpc('set_content_hidden', { p_kind: 'item', p_id: ids.items.penicillin, p_hidden: false })).error);
    assert.ifError((await mod.rpc('set_content_hidden', { p_kind: 'release', p_id: ids.release, p_hidden: false })).error);
    assert.equal((await recipeRows(anon, ids.items.penicillin)).length, 2);
    assert.equal((await ids_of(anon.from('releases').select('id').eq('id', ids.release))).size, 1);
  });

  test('one person can file at most 20 reports a day', async () => {
    const client = users.guest.client;
    for (let i = 0; i < 20; i++) {
      const { error } = await client.from('reports').insert({ target_kind: 'comment', comment_id: randomUUID(), reason: 'spam' });
      assert.ifError(error);
    }
    assert.ok((await client.from('reports').insert({ target_kind: 'comment', comment_id: randomUUID(), reason: 'spam' })).error);
  });

  test('signed-out visitors can\'t report', async () => {
    assert.ok((await anon.from('reports').insert({ target_kind: 'item', item_id: ids.items.penicillin, reason: 'spam' })).error);
  });
});
