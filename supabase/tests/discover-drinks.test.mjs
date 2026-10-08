// Discover's reads in SQL (supabase/migrations/20261008330000_discover_drinks_rpc.sql):
// discover_drinks, flavor_baseline and flavor_for_you run as the caller, so
// they must return nothing the caller couldn't already select. Runs through
// the real API. Local stack only: `npm run test:security`.
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
  throw new Error(`Refusing to run discover drinks tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const DIMS = ['sweet', 'sour', 'bitter', 'strong', 'botanical', 'herbal', 'fruity', 'spiced', 'spicy', 'smoky', 'savory', 'creamy'];
// Somewhere in the South Atlantic, far from every seeded bar.
const HERE = { lat: -41.2345, lng: -12.3456 };
const ids = {};
const users = {};

async function makeUser(label) {
  const email = `${label}-${run}@discover-test.local`;
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

const item = async (row) => (await serviceInsert('items', { ...row, name: `${row.name} ${run}` })).id;

async function profile(itemId, values, coverage = 1) {
  const cols = Object.fromEntries(DIMS.map((d) => [d, values[d] ?? 0]));
  await db.query(
    `INSERT INTO public.item_flavors (item_id, ${DIMS.join(', ')}, coverage, source, spec_fingerprint, rules_version)
     VALUES ($1, ${DIMS.map((_, i) => `$${i + 2}`).join(', ')}, $${DIMS.length + 2}, 'rules', 'test', 1)`,
    [itemId, ...DIMS.map((d) => cols[d]), coverage]
  );
}

const near = (client, extra = {}) =>
  client.rpc('discover_drinks', { p_latitude: HERE.lat, p_longitude: HERE.lng, p_radius_km: 5, ...extra });

const mine = (rows) => rows.filter((r) => r.name.endsWith(run));

before(async () => {
  await db.connect();
  for (const label of ['viewer', 'creator', 'ranker']) users[label] = await makeUser(label);

  // An open bar page (claimed, specs shown), an unclaimed bar (specs hidden), a closed one, one far away.
  ids.bar = (await serviceInsert('bars', { name: `Discover Bar ${run}` })).id;
  const bar = (row) => serviceInsert('profiles', { kind: 'bar', is_public: true, ...row, handle: `${row.handle}${run}`, display_name: `${row.display_name} ${run}` });
  ids.open = (await bar({ handle: 'opencafe', display_name: 'Open Café', bar_id: ids.bar, latitude: HERE.lat, longitude: HERE.lng, city: 'Atlantis', country_code: 'AQ' })).id;
  ids.unclaimed = (await bar({ handle: 'unclaimed', display_name: 'Quiet Room', latitude: HERE.lat + 0.01, longitude: HERE.lng, city: 'Atlantis', country_code: 'AQ' })).id;
  ids.closed = (await bar({ handle: 'closed', display_name: 'Last Orders', latitude: HERE.lat, longitude: HERE.lng + 0.01, is_closed: true })).id;
  ids.far = (await bar({ handle: 'faraway', display_name: 'Far Away', latitude: HERE.lat + 1, longitude: HERE.lng, city: 'Elsewhere', country_code: 'AQ' })).id;

  ids.gin = await item({ name: 'Plymouth Gin', item_type: 'ingredient' });
  ids.lime = await item({ name: 'Lime', item_type: 'ingredient' });
  ids.secret = await item({ name: 'Secret House Bottle', item_type: 'ingredient' });
  ids.classic = await item({ name: 'Gimlet', item_type: 'cocktail', is_catalog: true });

  const credited = (name, profileId, extra = {}) => item({ name, item_type: 'cocktail', origin_bar_profile_id: profileId, ...extra });
  ids.gimlet = await credited('Harbour Gimlet', ids.open, { riff_of_id: ids.classic, description: 'A café crème twist' });
  ids.quiet = await credited('Quiet Sour', ids.unclaimed);
  ids.closedDrink = await credited('Closing Time', ids.closed);
  ids.farDrink = await credited('Far Fizz', ids.far);
  // Credited to the bar but made by a person who keeps it private: not readable, so never listed.
  const { data: own, error } = await users.creator.client
    .from('items')
    .insert({ item_type: 'cocktail', name: `Private Riff ${run}`, origin_bar_profile_id: ids.open })
    .select('id')
    .single();
  if (error) throw error;
  ids.privateDrink = own.id;

  for (const [drinkId, lines] of [[ids.gimlet, [ids.gin, ids.lime]], [ids.quiet, [ids.secret, ids.lime]]]) {
    for (const [i, ingredient] of lines.entries()) await serviceInsert('recipes', { recipe_item_id: drinkId, ingredient_item_id: ingredient, amount: 30, unit: 'ml', sort_order: i });
  }

  // A hero photo, a sketch after it, and a top-down shot that must never be the thumbnail.
  const image = async (url) => (await serviceInsert('images', { url: `https://example.test/${url}-${run}.jpg` })).id;
  await serviceInsert('item_images', { item_id: ids.gimlet, image_id: await image('top'), angle: 'top', sort_order: -1 });
  await serviceInsert('item_images', { item_id: ids.gimlet, image_id: await image('hero'), angle: 'hero', sort_order: 1 });

  await profile(ids.gimlet, { sour: 0.9, fruity: 0.5, bitter: 0.1 });
  await profile(ids.quiet, { bitter: 0.9 }, 0.3);

  const edition = await serviceInsert('profile_menu_editions', { profile_id: ids.open, name: `Now ${run}`, year: 2026, is_current: true });
  await serviceInsert('profile_menu_edition_drinks', { edition_id: edition.id, item_id: ids.gimlet, sort_order: 0 });

  // Two drinks with one odd profile, for For you; the ranker has ranked the first.
  const odd = { sweet: 0.111, sour: 0.222, bitter: 0.333, strong: 0.444, botanical: 0.123, herbal: 0.555, fruity: 0.666, spiced: 0.234, spicy: 0.888, smoky: 0.777, savory: 0.345, creamy: 0.999 };
  ids.twinA = await item({ name: 'Twin A', item_type: 'cocktail' });
  ids.twinB = await item({ name: 'Twin B', item_type: 'cocktail' });
  ids.twinHidden = await item({ name: 'Twin Staff', item_type: 'cocktail', bar_id: ids.bar, override_visibility_level: 30 });
  for (const id of [ids.twinA, ids.twinB, ids.twinHidden]) await profile(id, odd);
  ids.odd = odd;
  await db.query(
    `INSERT INTO private.age_checks (user_id, country_code, minimum_age, confirmed_at) VALUES ($1, 'AU', 18, now()) ON CONFLICT (user_id) DO NOTHING`,
    [users.ranker.id]
  );
  await db.query(
    `INSERT INTO public.rank_entries (user_id, item_id, ranked_as_item_id, venue_profile_id, sentiment, rank_key) VALUES ($1, $2, $2, $3, 'loved', 1)`,
    [users.ranker.id, ids.twinA, ids.open]
  );
});

after(async () => {
  const like = `%${run}%`;
  const { rows } = await db.query('SELECT id FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.rank_entries WHERE user_id = $1', [users.ranker.id]);
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM private.item_flavor_jobs WHERE item_id = ANY($1)', [rows.map((r) => r.id)]);
  await db.query('DELETE FROM public.images WHERE url LIKE $1', [like]);
  await db.query('DELETE FROM public.profiles WHERE handle LIKE $1', [like]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('discover_drinks', () => {
  test('is for signed-in people only', async () => {
    const { error } = await near(anon);
    assert.ok(error, 'signed out cannot call it');
  });

  test('near a point: public, open bars in the radius, and only drinks the caller can read', async () => {
    const { data, error } = await near(users.viewer.client);
    assert.ifError(error);
    const names = mine(data).map((r) => r.name).sort();
    assert.deepEqual(names, [`Harbour Gimlet ${run}`, `Quiet Sour ${run}`]);
    // The same drinks the caller gets by selecting items directly (the private riff is invisible both ways).
    const { data: direct } = await users.viewer.client.from('items').select('id').in('origin_bar_profile_id', [ids.open, ids.unclaimed]);
    assert.deepEqual(direct.map((r) => r.id).sort(), mine(data).map((r) => r.id).sort());
  });

  test('carries what Discover shows: classic, ingredients as masked, hero picture, menu run, notes', async () => {
    const { data } = await near(users.viewer.client);
    const gimlet = data.find((r) => r.id === ids.gimlet);
    assert.equal(gimlet.riff_of, `Gimlet ${run}`);
    assert.deepEqual(gimlet.ingredients, [`Plymouth Gin ${run}`, `Lime ${run}`]);
    assert.equal(gimlet.image_url, `https://example.test/hero-${run}.jpg`, 'the hero, never the top-down shot');
    assert.equal(gimlet.bar_profile_id, ids.open);
    assert.deepEqual(gimlet.menu_run, [2026, null, null, null, 1], 'on now since 2026');
    assert.equal(data.find((r) => r.id === ids.quiet).menu_run, null, 'never on a menu');
    assert.deepEqual(gimlet.notes, ['sour', 'fruity']);
    const quiet = data.find((r) => r.id === ids.quiet);
    // An unclaimed bar's page hides its specs: no ingredient names, as through app_recipe_presentation.
    const { data: lines } = await users.viewer.client.from('app_recipe_presentation').select('display_ingredient_id').eq('recipe_item_id', ids.quiet);
    assert.equal(lines.filter((l) => l.display_ingredient_id).length, quiet.ingredients.length);
    assert.ok(!quiet.ingredients.includes(`Secret House Bottle ${run}`));
    assert.deepEqual(quiet.notes, [], 'a profile covering under half its spec is not used');
  });

  test('a city, and anywhere, keep closed bars out', async () => {
    const { data: city, error } = await users.viewer.client.rpc('discover_drinks', { p_city: 'atlantis', p_country_code: 'aq' });
    assert.ifError(error);
    assert.deepEqual(mine(city).map((r) => r.id).sort(), [ids.gimlet, ids.quiet].sort());
    const { data: everywhere } = await users.viewer.client.rpc('discover_drinks', { p_query: run });
    assert.deepEqual(mine(everywhere).map((r) => r.id).sort(), [ids.gimlet, ids.quiet, ids.farDrink].sort());
  });

  test('a search needs every word, in any of name, classic, description, ingredients or bar, accents folded', async () => {
    const search = async (q) => mine((await users.viewer.client.rpc('discover_drinks', { p_query: `${q} ${run}` })).data).map((r) => r.id);
    assert.deepEqual(await search('cafe creme'), [ids.gimlet], 'description, without accents');
    assert.deepEqual(await search('plymouth'), [ids.gimlet], 'an ingredient');
    assert.deepEqual(await search('gimlet harbour'), [ids.gimlet]);
    assert.deepEqual(await search('quiet room'), [ids.quiet], 'the bar name');
    assert.deepEqual(await search('secret'), [], 'a masked ingredient is not searchable');
  });

  test('pages by id', async () => {
    const all = mine((await near(users.viewer.client)).data).map((r) => r.id).sort();
    const first = (await near(users.viewer.client, { p_limit: 1, p_query: run })).data;
    assert.equal(first.length, 1);
    const rest = (await near(users.viewer.client, { p_after: first[0].id, p_query: run })).data;
    assert.deepEqual([...first, ...rest].map((r) => r.id), all);
    const before = (await near(users.viewer.client, { p_before: all[1], p_query: run })).data;
    assert.deepEqual(before.map((r) => r.id), [all[0]]);
  });

  test('rejects half a point', async () => {
    const { error } = await users.viewer.client.rpc('discover_drinks', { p_latitude: 1 });
    assert.ok(error);
  });
});

describe('flavor_for_you and flavor_baseline', () => {
  test('signed out can call neither', async () => {
    assert.ok((await anon.rpc('flavor_baseline')).error);
    assert.ok((await anon.rpc('flavor_for_you', { p_taste: { sweet: 0.5 } })).error);
  });

  test('nearest first, leaving out what you ranked and what you cannot read', async () => {
    const top = async (user) => (await users[user].client.rpc('flavor_for_you', { p_taste: ids.odd, p_limit: 3 })).data.map((r) => r.id);
    const viewer = await top('viewer');
    assert.deepEqual(viewer.slice(0, 2).sort(), [ids.twinA, ids.twinB].sort());
    assert.ok(!viewer.includes(ids.twinHidden), 'a bar drink staff keep to themselves stays out');
    const ranker = await top('ranker');
    assert.equal(ranker[0], ids.twinB);
    assert.ok(!ranker.includes(ids.twinA), 'a ranked drink is left out');
  });

  test('a taste with no dimensions finds nothing', async () => {
    const { data, error } = await users.viewer.client.rpc('flavor_for_you', { p_taste: { colour: 1, sweet: 'very' } });
    assert.ifError(error);
    assert.deepEqual(data, []);
  });

  test('the baseline averages the profiles the caller can read', async () => {
    const { data, error } = await users.viewer.client.rpc('flavor_baseline');
    assert.ifError(error);
    assert.ok(data[0].drinks > 0);
    for (const d of DIMS) assert.ok(data[0][d] >= 0 && data[0][d] <= 1, d);
    // Every usable profile, including the staff-only twin the viewer can't read (other tests may add more meanwhile).
    const { rows } = await db.query('SELECT count(*)::int AS n FROM public.item_flavors WHERE coverage >= 0.5');
    assert.ok(data[0].drinks < rows[0].n, 'counts only readable profiles');
  });
});
