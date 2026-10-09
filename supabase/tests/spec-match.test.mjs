// Same spec or a variation: a bar's version of a catalog classic
// (supabase/migrations/20261010900000_spec_match.sql). The verdict is worked
// out from the full spec, and spec_matches() answers as the caller sees the
// spec: a Locked bar page reads as unlisted, floor staff see generic names and
// no measures. Local stack only: `npm run test:security`.
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
  throw new Error(`Refusing to run spec match tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const ids = {};
const users = {};
const created = [];

async function makeUser(label) {
  const email = `${label}-${run}@spec-match-test.local`;
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

async function item(key, row) {
  ids[key] = (await serviceInsert('items', row)).id;
  created.push(ids[key]);
}

const ingredient = (key, name, extra = {}) => item(key, { name: `${name} ${run}`, item_type: 'ingredient', ...extra });

/** Lines as [ingredient key, ml or null, more columns]. */
async function recipe(key, lines) {
  for (const [i, [ing, ml = null, more = {}]] of lines.entries()) {
    await serviceInsert('recipes', {
      recipe_item_id: ids[key],
      ingredient_item_id: ids[ing],
      amount: ml,
      unit: ml == null ? null : 'ml',
      sort_order: i,
      ...more,
    });
  }
}

/** { key: { spec_match, notes } } for these keys, as this user sees them. */
async function matches(user, keys) {
  const { data, error } = await users[user].client.rpc('spec_matches', { p_item_ids: keys.map((k) => ids[k]) });
  assert.ifError(error);
  const key = Object.fromEntries(Object.entries(ids).map(([k, v]) => [v, k]));
  return Object.fromEntries(data.map((r) => [key[r.item_id], { spec_match: r.spec_match, notes: r.notes }]));
}

const name = (base) => `${base} ${run}`;

before(async () => {
  await db.connect();
  for (const label of ['admin', 'stranger', 'venueAdmin', 'floor']) users[label] = await makeUser(label);
  await db.query('INSERT INTO private.app_admins (user_id) VALUES ($1)', [users.admin.id]);

  // The tree: Spirit > Whiskey > Bourbon / Rye; Woodford is a Bourbon, Pikesville a Rye.
  const spirit = await db.query(
    "SELECT id FROM public.items WHERE item_type = 'ingredient' AND bar_id IS NULL AND name = 'Spirit' AND generic_id IS NULL LIMIT 1"
  );
  if (spirit.rows[0]) ids.spirit = spirit.rows[0].id;
  else await item('spirit', { name: 'Spirit', item_type: 'ingredient', ingredient_role: 'generic' });
  await ingredient('whiskey', 'Test Whiskey', { ingredient_role: 'generic', generic_id: ids.spirit });
  await ingredient('bourbon', 'Test Bourbon', { ingredient_role: 'generic', generic_id: ids.whiskey });
  await ingredient('rye', 'Test Rye', { ingredient_role: 'generic', generic_id: ids.whiskey });
  await ingredient('woodford', 'Test Woodford', { ingredient_role: 'product', generic_id: ids.bourbon });
  await ingredient('pikesville', 'Test Pikesville', { ingredient_role: 'product', generic_id: ids.rye });
  await ingredient('mezcal', 'Test Mezcal', { ingredient_role: 'generic', generic_id: ids.spirit });
  await ingredient('wine', 'Test Aromatised', { ingredient_role: 'generic' });
  await ingredient('vermouth', 'Test Vermouth', { ingredient_role: 'generic', generic_id: ids.wine });
  await ingredient('sweet', 'Test Sweet Vermouth', { ingredient_role: 'generic', generic_id: ids.vermouth });
  await ingredient('carpano', 'Test Carpano', { ingredient_role: 'product', generic_id: ids.sweet });
  await ingredient('campari', 'Test Campari', { ingredient_role: 'product' });
  await ingredient('peel', 'Test Orange');
  await ingredient('bitters', 'Test Orange Bitters');

  await item('classic', { name: name('Boulevardier'), item_type: 'cocktail', is_catalog: true });
  await recipe('classic', [['bourbon', 45], ['campari', 30], ['sweet', 30], ['peel', 1, { unit: 'peel' }]]);

  // An Open bar page, a Locked (unclaimed) one, and a venue with its own drinks.
  ids.bar = (await serviceInsert('bars', { name: name('Gold Room'), page_visibility: 'open' })).id;
  ids.openProfile = (await serviceInsert('profiles', { kind: 'bar', handle: `gold${run}`, display_name: name('Gold Room'), bar_id: ids.bar, is_public: true })).id;
  ids.lockedProfile = (await serviceInsert('profiles', { kind: 'bar', handle: `moth${run}`, display_name: name('Pale Moth'), is_public: true })).id;
  ids.venue = (await serviceInsert('bars', { name: name('Long Island Bar') })).id;
  await serviceInsert('user_bars', { user_id: users.venueAdmin.id, bar_id: ids.venue, role_level: 40 });
  await serviceInsert('user_bars', { user_id: users.floor.id, bar_id: ids.venue, role_level: 20 });

  const credited = (key, base, profile) =>
    item(key, { name: name(base), item_type: 'cocktail', origin_bar_profile_id: ids[profile], riff_of_id: ids.classic });
  await credited('v_same', 'Boulevardier', 'openProfile');
  await recipe('v_same', [['woodford'], ['campari'], ['carpano'], ['bitters', 2, { unit: 'dash' }], ['peel', 1, { unit: 'peel' }]]);
  await credited('v_rye', 'The Boulevardier', 'openProfile');
  await recipe('v_rye', [['rye'], ['campari'], ['sweet']]);
  await credited('v_partial', 'Boulevardier', 'openProfile');
  await recipe('v_partial', [['bourbon'], ['campari']]);
  await credited('v_empty', 'Boulevardier', 'openProfile');
  await credited('v_mezcal', 'Boulevardier', 'openProfile');
  await recipe('v_mezcal', [['bourbon'], ['campari'], ['sweet'], ['mezcal']]);
  await credited('v_riff', 'Plum Boulevardier', 'openProfile');
  await recipe('v_riff', [['bourbon'], ['campari'], ['sweet']]);
  await credited('v_locked', 'Boulevardier', 'lockedProfile');
  await recipe('v_locked', [['rye'], ['campari'], ['sweet']]);

  // Venue drinks with measures. Floor staff see generic names and no amounts.
  const venue = (key) => item(key, { name: name('Boulevardier'), item_type: 'cocktail', bar_id: ids.venue, riff_of_id: ids.classic });
  await venue('venueSame');
  await recipe('venueSame', [['woodford', 44], ['campari', 30], ['carpano', 31]]);
  await venue('venueMeasures');
  await recipe('venueMeasures', [['bourbon', 60], ['campari', 20], ['sweet', 20]]);
  await venue('venueRye');
  await recipe('venueRye', [['pikesville', 45], ['campari', 30], ['sweet', 30]]);
});

after(async () => {
  await db.query('DELETE FROM public.recipes WHERE recipe_item_id = ANY($1)', [created]);
  await db.query('DELETE FROM public.items WHERE id = ANY($1)', [created.slice().reverse()]);
  await db.query('DELETE FROM public.user_bars WHERE bar_id = $1', [ids.venue]);
  await db.query('DELETE FROM public.profiles WHERE id = ANY($1)', [[ids.openProfile, ids.lockedProfile]]);
  await db.query('DELETE FROM public.bars WHERE id = ANY($1)', [[ids.bar, ids.venue]]);
  await db.query('DELETE FROM private.app_admins WHERE user_id = $1', [users.admin.id]);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
  await db.end();
});

describe('spec_matches verdicts', () => {
  test('bottles of the same styles, bitters and garnish aside, are the same spec', async () => {
    const m = await matches('stranger', ['v_same']);
    assert.deepEqual(m.v_same, { spec_match: 'same', notes: {} });
  });

  test('rye for bourbon is a variation that says so', async () => {
    const m = await matches('stranger', ['v_rye']);
    assert.equal(m.v_rye.spec_match, 'variation');
    assert.deepEqual(m.v_rye.notes, { swaps: [{ to: name('Test Rye'), from: name('Test Bourbon'), base: true }] });
  });

  test('a partial spec or none takes the default cocktail', async () => {
    const m = await matches('stranger', ['v_partial', 'v_empty']);
    assert.equal(m.v_partial.spec_match, 'unlisted');
    assert.equal(m.v_empty.spec_match, 'unlisted');
  });

  test('an added ingredient is a variation', async () => {
    const m = await matches('stranger', ['v_mezcal']);
    assert.equal(m.v_mezcal.spec_match, 'variation');
    assert.deepEqual(m.v_mezcal.notes, { adds: [{ name: name('Test Mezcal'), house: false }] });
  });

  test('a different name is a riff', async () => {
    const m = await matches('stranger', ['v_riff']);
    assert.equal(m.v_riff.spec_match, 'riff');
  });

  test('other measures are a variation', async () => {
    const m = await matches('venueAdmin', ['venueSame', 'venueMeasures']);
    assert.equal(m.venueSame.spec_match, 'same');
    assert.equal(m.venueMeasures.spec_match, 'variation');
    assert.deepEqual(m.venueMeasures.notes, { measures: true });
  });
});

describe('spec_matches answers as the caller sees the spec', () => {
  test('a Locked bar page reads as unlisted, with nothing about what changed', async () => {
    const stranger = await matches('stranger', ['v_locked']);
    assert.deepEqual(stranger.v_locked, { spec_match: 'unlisted', notes: {} });
    const admin = await matches('admin', ['v_locked']);
    assert.equal(admin.v_locked.spec_match, 'variation');
  });

  test('floor staff see generic names and nothing about measures', async () => {
    const admin = await matches('venueAdmin', ['venueRye']);
    assert.deepEqual(admin.venueRye.notes, { swaps: [{ to: name('Test Pikesville'), from: name('Test Bourbon'), base: true }] });
    const floor = await matches('floor', ['venueSame', 'venueMeasures', 'venueRye']);
    assert.equal(floor.venueSame.spec_match, 'unlisted');
    assert.equal(floor.venueMeasures.spec_match, 'unlisted');
    assert.deepEqual(floor.venueRye, {
      spec_match: 'variation',
      notes: { swaps: [{ to: name('Test Rye'), from: name('Test Bourbon'), base: true }] },
    });
  });

  test('a drink the caller cannot see returns nothing', async () => {
    const m = await matches('stranger', ['venueSame']);
    assert.deepEqual(m, {});
  });
});

describe('keeping it fresh', () => {
  test('editing a line recomputes the verdict', async () => {
    await db.query('UPDATE public.recipes SET ingredient_item_id = $2 WHERE recipe_item_id = $1 AND ingredient_item_id = $3', [ids.v_rye, ids.bourbon, ids.rye]);
    const m = await matches('stranger', ['v_rye']);
    assert.equal(m.v_rye.spec_match, 'same');
  });

  test("changing the classic's spec recomputes its versions", async () => {
    await recipe('classic', [['mezcal', 15, { sort_order: 10 }]]);
    const m = await matches('stranger', ['v_mezcal', 'v_same']);
    assert.equal(m.v_mezcal.spec_match, 'same');
    assert.equal(m.v_same.spec_match, 'unlisted');
    await db.query('DELETE FROM public.recipes WHERE recipe_item_id = $1 AND ingredient_item_id = $2', [ids.classic, ids.mezcal]);
  });

  test('the name key ignores case, accents, punctuation and a leading "The"', async () => {
    const { rows } = await db.query(
      "SELECT private.drink_name_key('The Boulevardier.') = private.drink_name_key('boulevardier') AS a, private.drink_name_key('Café Brûlot') AS b"
    );
    assert.equal(rows[0].a, true);
    assert.equal(rows[0].b, 'cafe brulot');
  });
});

describe('set_spec_match', () => {
  test("the venue's admin can call their drink the classic", async () => {
    const { error } = await users.venueAdmin.client.rpc('set_spec_match', { p_item_id: ids.venueMeasures, p_spec_match: 'same' });
    assert.ifError(error);
    const m = await matches('venueAdmin', ['venueMeasures']);
    assert.equal(m.venueMeasures.spec_match, 'same');
    await users.venueAdmin.client.rpc('set_spec_match', { p_item_id: ids.venueMeasures, p_spec_match: null });
    assert.equal((await matches('venueAdmin', ['venueMeasures'])).venueMeasures.spec_match, 'variation');
  });

  test('floor staff and strangers cannot', async () => {
    for (const [user, key] of [['floor', 'venueMeasures'], ['stranger', 'v_same']]) {
      const { error } = await users[user].client.rpc('set_spec_match', { p_item_id: ids[key], p_spec_match: 'variation' });
      assert.ok(error, `${user} should be refused`);
    }
  });

  test('signed out cannot read verdicts', async () => {
    const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
    const { error } = await anon.rpc('spec_matches', { p_item_ids: [ids.v_same] });
    assert.ok(error);
  });
});
