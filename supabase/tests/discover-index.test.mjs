// Discover a page at a time (supabase/migrations/20261009500000_discover_index.sql):
// discover_drink_facts, discover_list and discover_bars. The facts' styles
// and spirits must match lib/drinkStyles.ts on every local bar drink, the
// reads must return nothing the caller couldn't select, and pages must add up
// to the whole list. Local stack only: `npm run test:security`.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { tsImport } from 'tsx/esm/api';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run discover index tests against a non-local API: ${status.API_URL}`);
}

const { stylesOf, spiritsOf } = await tsImport('../../lib/drinkStyles.ts', import.meta.url);

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const DIMS = ['sweet', 'sour', 'bitter', 'strong', 'herbal', 'fruity', 'smoky', 'spicy', 'creamy'];
// In the South Pacific, far from every seeded bar, and next to the antimeridian.
const HERE = { lat: -21.2345, lng: 179.99 };
const ids = {};
const users = {};

async function makeUser(label) {
  const email = `${label}-${run}@discover-index-test.local`;
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
// What the 30-second job would do, now.
const settle = () => db.query('SELECT private.run_discover_dirty(100000)');

const near = (client, extra = {}) => client.rpc('discover_list', { p_latitude: HERE.lat, p_longitude: HERE.lng, p_radius_km: 5, p_query: run, ...extra });
const mine = (rows) => (rows ?? []).filter((r) => r.name.endsWith(run));

before(async () => {
  await db.connect();
  for (const label of ['viewer', 'creator']) users[label] = await makeUser(label);

  ids.bar = (await serviceInsert('bars', { name: `Index Bar ${run}`, page_visibility: 'open' })).id;
  const bar = (row) => serviceInsert('profiles', { kind: 'bar', is_public: true, ...row, handle: `${row.handle}${run}`, display_name: `${row.display_name} ${run}` });
  ids.open = (await bar({ handle: 'ixopen', display_name: 'Open Shed', bar_id: ids.bar, latitude: HERE.lat, longitude: HERE.lng, city: 'Lau', country_code: 'FJ' })).id;
  // Across the antimeridian from the open bar, under 2 km away.
  ids.east = (await bar({ handle: 'ixeast', display_name: 'Date Line', latitude: HERE.lat, longitude: -179.995, city: 'Lau', country_code: 'FJ' })).id;
  ids.closed = (await bar({ handle: 'ixclosed', display_name: 'Shut Tight', latitude: HERE.lat + 0.01, longitude: HERE.lng, is_closed: true })).id;

  ids.gin = await item({ name: 'Plymouth Gin', item_type: 'ingredient' });
  ids.lime = await item({ name: 'Lime', item_type: 'ingredient' });
  ids.syrup = await item({ name: 'Simple Syrup', item_type: 'ingredient' });
  const credited = (name, profileId, extra = {}) => item({ name, item_type: 'cocktail', origin_bar_profile_id: profileId, ...extra });
  ids.sour = await credited('Shed Sour', ids.open, { description: 'Bright and sharp' });
  ids.martini = await credited('House Martini', ids.open);
  ids.lineMartini = await credited('Date Line Martini', ids.east);
  ids.zzz = await credited('1999', ids.open);
  ids.closedDrink = await credited('Last Call', ids.closed);
  const { data: own, error } = await users.creator.client
    .from('items')
    .insert({ item_type: 'cocktail', name: `Private Martini ${run}`, origin_bar_profile_id: ids.open })
    .select('id')
    .single();
  if (error) throw error;
  ids.privateDrink = own.id;

  for (const [i, ingredient] of [ids.gin, ids.lime, ids.syrup].entries()) {
    await serviceInsert('recipes', { recipe_item_id: ids.sour, ingredient_item_id: ingredient, amount: 30, unit: 'ml', sort_order: i });
  }
  const cols = Object.fromEntries(DIMS.map((d) => [d, d === 'sour' ? 0.9 : 0]));
  await db.query(
    `INSERT INTO public.item_flavors (item_id, ${DIMS.join(', ')}, coverage, source, spec_fingerprint, rules_version)
     VALUES ($1, ${DIMS.map((_, i) => `$${i + 2}`).join(', ')}, 1, 'rules', 'test', 1)`,
    [ids.sour, ...DIMS.map((d) => cols[d])]
  );
  const image = (await serviceInsert('images', { url: `https://example.test/ix-hero-${run}.jpg` })).id;
  await serviceInsert('item_images', { item_id: ids.martini, image_id: image, angle: 'hero', sort_order: 0 });
  const edition = await serviceInsert('profile_menu_editions', { profile_id: ids.open, name: `Now ${run}`, year: 2026, is_current: true });
  await serviceInsert('profile_menu_edition_drinks', { edition_id: edition.id, item_id: ids.martini, sort_order: 0 });
  await settle();
});

after(async () => {
  const like = `%${run}%`;
  const { rows } = await db.query('SELECT id FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM private.item_flavor_jobs WHERE item_id = ANY($1)', [rows.map((r) => r.id)]);
  await db.query('DELETE FROM private.discover_dirty WHERE item_id = ANY($1)', [rows.map((r) => r.id)]);
  await db.query('DELETE FROM public.images WHERE url LIKE $1', [like]);
  await db.query('DELETE FROM public.profiles WHERE handle LIKE $1', [like]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('discover_drink_facts', () => {
  test('styles and spirits match lib/drinkStyles.ts on every bar drink', async () => {
    // The same inputs refresh_discover_facts reads.
    const { rows } = await db.query(`
      SELECT f.item_id, f.styles, f.spirits, i.name, i.description, rf.name AS riff,
             CASE WHEN (i.created_by IS NULL AND coalesce(ob.page_visibility, 'description') = 'open') OR ps.id IS NOT NULL THEN (
               SELECT array_agg(n.name ORDER BY r.sort_order) FROM public.recipes r JOIN public.items n ON n.id = r.ingredient_item_id WHERE r.recipe_item_id = i.id
             ) END AS lines
      FROM public.discover_drink_facts f
      JOIN public.items i ON i.id = f.item_id
      JOIN public.profiles p ON p.id = i.origin_bar_profile_id
      LEFT JOIN public.bars ob ON ob.id = p.bar_id
      LEFT JOIN public.items rf ON rf.id = i.riff_of_id
      LEFT JOIN private.published_listing ps ON ps.id = i.id AND ps.effective_mode = 'spec'`);
    assert.ok(rows.length > 0);
    const sorted = (a) => [...(a ?? [])].sort();
    const differ = [];
    for (const r of rows) {
      const facts = { name: r.name, description: r.description, riffOf: r.riff, ingredients: r.lines ?? [] };
      const styles = sorted(stylesOf(facts));
      const spirits = sorted(spiritsOf(facts));
      if (JSON.stringify(styles) !== JSON.stringify(sorted(r.styles)) || JSON.stringify(spirits) !== JSON.stringify(sorted(r.spirits))) {
        differ.push({ name: r.name, ts: [styles, spirits], sql: [sorted(r.styles), sorted(r.spirits)] });
      }
    }
    assert.deepEqual(differ.slice(0, 10), [], `${differ.length} of ${rows.length} drinks differ`);
  });

  test('a change reaches the facts through the queue', async () => {
    const before = (await db.query('SELECT spirits FROM public.discover_drink_facts WHERE item_id = $1', [ids.martini])).rows[0];
    assert.deepEqual(before.spirits, []);
    await serviceInsert('recipes', { recipe_item_id: ids.martini, ingredient_item_id: ids.gin, amount: 60, unit: 'ml', sort_order: 0 });
    const marked = await db.query('SELECT 1 FROM private.discover_dirty WHERE item_id = $1', [ids.martini]);
    assert.equal(marked.rowCount, 1, 'the new line marks the drink');
    await settle();
    const after = (await db.query('SELECT spirits FROM public.discover_drink_facts WHERE item_id = $1', [ids.martini])).rows[0];
    assert.deepEqual(after.spirits, ['gin']);
  });

  test('is not readable signed out, and only for drinks the caller can read', async () => {
    const { data: signedOut } = await anon.from('discover_drink_facts').select('item_id').eq('item_id', ids.sour);
    assert.deepEqual(signedOut ?? [], []);
    const { data: viewer } = await users.viewer.client.from('discover_drink_facts').select('item_id').in('item_id', [ids.sour, ids.privateDrink]);
    assert.deepEqual(viewer.map((r) => r.item_id), [ids.sour]);
    const { data: creator } = await users.creator.client.from('discover_drink_facts').select('item_id').eq('item_id', ids.privateDrink);
    assert.deepEqual(creator.map((r) => r.item_id), [ids.privateDrink], 'its maker sees it');
  });
});

describe('discover_list', () => {
  test('is for signed-in people only', async () => {
    const { error } = await near(anon);
    assert.ok(error);
  });

  test('near a point, across the antimeridian: open bars only, nothing the caller cannot read, best first', async () => {
    const { data, error } = await near(users.viewer.client);
    assert.ifError(error);
    // On a menu now with a picture first, then the rest by name with letters before digits.
    assert.deepEqual(mine(data).map((r) => r.id), [ids.martini, ids.lineMartini, ids.sour, ids.zzz]);
    const first = data.find((r) => r.id === ids.martini);
    assert.equal(first.image_url, `https://example.test/ix-hero-${run}.jpg`);
    assert.deepEqual(first.menu_run, [2026, null, null, null, 1]);
    assert.equal(first.bar_name, `Open Shed ${run}`);
    assert.equal(first.total_drinks, 4);
    assert.equal(first.total_bars, 2);
  });

  test('a search puts name matches first and matches the bar name', async () => {
    const { data } = await near(users.viewer.client, { p_query: `martini ${run}` });
    assert.deepEqual(mine(data).map((r) => r.id), [ids.martini, ids.lineMartini]);
    const { data: byBar } = await near(users.viewer.client, { p_query: `date line ${run}` });
    assert.deepEqual(mine(byBar).map((r) => r.id), [ids.lineMartini]);
  });

  test('filters: any style picked, and every group picked', async () => {
    const { data: martinis } = await near(users.viewer.client, { p_styles: ['martini'] });
    assert.deepEqual(mine(martinis).map((r) => r.id).sort(), [ids.martini, ids.lineMartini].sort());
    const { data: sourGin } = await near(users.viewer.client, { p_styles: ['sour', 'martini'], p_spirits: ['gin'] });
    assert.deepEqual(mine(sourGin).map((r) => r.id).sort(), [ids.sour, ids.martini].sort());
    const { data: notes } = await near(users.viewer.client, { p_notes: ['sour'] });
    assert.deepEqual(mine(notes).map((r) => r.id), [ids.sour]);
  });

  test('one bar, and pages that add up to the whole list with totals on the first only', async () => {
    const { data: atBar } = await users.viewer.client.rpc('discover_list', { p_bar_id: ids.east, p_query: run });
    assert.deepEqual(mine(atBar).map((r) => r.id), [ids.lineMartini]);
    const all = mine((await near(users.viewer.client)).data).map((r) => r.id);
    const pages = [];
    let cursor = {};
    for (;;) {
      const { data, error } = await near(users.viewer.client, { p_limit: 1, ...cursor });
      assert.ifError(error);
      if (!data.length) break;
      if (pages.length) assert.equal(data[0].total_drinks, null);
      pages.push(...data);
      const last = data[data.length - 1];
      cursor = { p_after_rank: last.rank, p_after_name: last.name, p_after_id: last.id };
    }
    assert.deepEqual(pages.map((r) => r.id), all);
    const { error } = await near(users.viewer.client, { p_after_id: ids.sour });
    assert.ok(error, 'a cursor needs all three parts');
  });
});

describe('discover_bars', () => {
  test('an area: every public bar, closed ones flagged with no drinks, matching drinks counted', async () => {
    const { data, error } = await users.viewer.client.rpc('discover_bars', { p_latitude: HERE.lat, p_longitude: HERE.lng, p_radius_km: 5, p_styles: ['martini'] });
    assert.ifError(error);
    const byId = Object.fromEntries(data.map((b) => [b.id, b]));
    assert.equal(byId[ids.open].drinks, 1, 'the private martini is not counted');
    assert.equal(byId[ids.east].drinks, 1);
    assert.equal(byId[ids.closed].is_closed, true);
    assert.equal(byId[ids.closed].drinks, 0);
  });

  test('a box, including one across the antimeridian', async () => {
    const box = (w, s, e, n) => users.viewer.client.rpc('discover_bars', { p_west: w, p_south: s, p_east: e, p_north: n });
    const west = (await box(179.9, -21.3, 180, -21.2)).data.map((b) => b.id);
    assert.ok(west.includes(ids.open) && !west.includes(ids.east));
    const across = (await box(179.9, -21.3, -179.9, -21.2)).data.map((b) => b.id);
    assert.ok(across.includes(ids.open) && across.includes(ids.east));
    const { error } = await box(179.9, null, -179.9, -21.2);
    assert.ok(error, 'a box needs all four sides');
  });
});
