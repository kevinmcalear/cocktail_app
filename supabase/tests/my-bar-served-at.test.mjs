// My Bar's What to make, one row per recipe
// (supabase/migrations/20261011120000_my_bar_served_at.sql): a bar's version
// that is the classic, as the caller sees it, folds into the classic's row,
// which says where it's served; a variation keeps its row and says what it
// changes. Local stack only: `npm run test:security`.
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
  throw new Error(`Refusing to run served-at tests against a non-local API: ${status.API_URL}`);
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
  const email = `${label}-${run}@served-at-test.local`;
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

const name = (base) => `${base} ${run}`;

/** Lines as [ingredient key, ml]. */
async function recipe(key, lines) {
  for (const [i, [ing, ml]] of lines.entries()) {
    await serviceInsert('recipes', { recipe_item_id: ids[key], ingredient_item_id: ids[ing], amount: ml, unit: 'ml', sort_order: i });
  }
}

/** This run's rows of my_bar_drinks, by key. */
async function whatToMake(user) {
  const { data, error } = await users[user].client.rpc('my_bar_drinks', { p_two_away: true });
  assert.ifError(error);
  const key = Object.fromEntries(Object.entries(ids).map(([k, v]) => [v, k]));
  return Object.fromEntries(data.filter((r) => key[r.id]).map((r) => [key[r.id], r]));
}

before(async () => {
  await db.connect();
  for (const label of ['home', 'admin', 'member']) users[label] = await makeUser(label);
  await db.query('INSERT INTO private.app_admins (user_id) VALUES ($1)', [users.admin.id]);

  // Bourbon and Rye are both a kind of Whiskey, so one for the other reads as a swap.
  await item('spirits', { name: name('Served Spirits'), item_type: 'ingredient', ingredient_role: 'generic' });
  await item('whiskey', { name: name('Served Whiskey'), item_type: 'ingredient', ingredient_role: 'generic', generic_id: ids.spirits });
  for (const [key, label] of [['bourbon', 'Bourbon'], ['rye', 'Rye']]) {
    await item(key, { name: name(`Served ${label}`), item_type: 'ingredient', ingredient_role: 'generic', generic_id: ids.whiskey });
  }
  for (const [key, label] of [['campari', 'Campari'], ['sweet', 'Sweet Vermouth']]) {
    await item(key, { name: name(`Served ${label}`), item_type: 'ingredient', ingredient_role: 'generic' });
  }

  ids.bar = (await serviceInsert('bars', { name: name('Gold Room'), page_visibility: 'open' })).id;
  ids.goldRoom = (await serviceInsert('profiles', { kind: 'bar', handle: `sgold${run}`, display_name: name('Gold Room'), bar_id: ids.bar, is_public: true })).id;
  ids.lions = (await serviceInsert('profiles', { kind: 'bar', handle: `slions${run}`, display_name: name('The Lions'), is_public: true })).id;
  ids.moth = (await serviceInsert('profiles', { kind: 'bar', handle: `smoth${run}`, display_name: name('Pale Moth'), is_public: true })).id;
  ids.venue = (await serviceInsert('bars', { name: name('Long Island Bar') })).id;
  await serviceInsert('user_bars', { user_id: users.member.id, bar_id: ids.venue, role_level: 40 });

  // The classic, credited to the Gold Room, so the Gold Room leads its served-at list.
  await item('classic', { name: name('Boulevardier'), item_type: 'cocktail', is_catalog: true, origin_bar_profile_id: ids.goldRoom });
  await recipe('classic', [['bourbon', 45], ['campari', 30], ['sweet', 30]]);

  const version = (key, profile, extra = {}) =>
    item(key, { name: name('Boulevardier'), item_type: 'cocktail', origin_bar_profile_id: ids[profile], riff_of_id: ids.classic, ...extra });
  // The Gold Room's own copy, same spec: folds.
  await version('goldCopy', 'goldRoom');
  await recipe('goldCopy', [['bourbon', 45], ['campari', 30], ['sweet', 30]]);
  // The Lions list it with no spec: still served there.
  await version('lionsCopy', 'lions');
  // An Open bar's rye version: a variation with its own row.
  await version('ryeVersion', 'goldRoom', { name: name('The Boulevardier') });
  await recipe('ryeVersion', [['rye', 45], ['campari', 30], ['sweet', 30]]);
  // A Locked (unclaimed) bar's rye version: unlisted to most, a variation to an app admin.
  await version('lockedRye', 'moth');
  await recipe('lockedRye', [['rye', 45], ['campari', 30], ['sweet', 30]]);
  // A riff on it.
  await version('riff', 'goldRoom', { name: name('Plum Boulevardier') });
  await recipe('riff', [['bourbon', 45], ['campari', 30], ['sweet', 30]]);
  // A venue's own copy: only its members see it.
  await item('venueCopy', { name: name('Boulevardier'), item_type: 'cocktail', bar_id: ids.venue, riff_of_id: ids.classic });
  await recipe('venueCopy', [['bourbon', 45], ['campari', 30], ['sweet', 30]]);

  for (const user of ['home', 'admin', 'member']) {
    for (const key of ['bourbon', 'rye', 'campari', 'sweet']) {
      const { error } = await users[user].client.from('home_bar_items').insert({ item_id: ids[key] });
      assert.ifError(error);
    }
  }
});

after(async () => {
  await db.query('DELETE FROM public.home_bar_items WHERE user_id = ANY($1)', [Object.values(users).map((u) => u.id)]);
  await db.query('DELETE FROM public.recipes WHERE recipe_item_id = ANY($1)', [created]);
  await db.query('DELETE FROM public.items WHERE id = ANY($1)', [created.slice().reverse()]);
  await db.query('DELETE FROM public.user_bars WHERE bar_id = $1', [ids.venue]);
  await db.query('DELETE FROM public.profiles WHERE id = ANY($1)', [[ids.goldRoom, ids.lions, ids.moth]]);
  await db.query('DELETE FROM public.bars WHERE id = ANY($1)', [[ids.bar, ids.venue]]);
  await db.query('DELETE FROM private.app_admins WHERE user_id = $1', [users.admin.id]);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
  await db.end();
});

describe('my_bar_drinks: one row per recipe', () => {
  test("a bar's copy of the classic folds into the classic's row", async () => {
    const rows = await whatToMake('home');
    assert.ok(rows.classic, 'the classic is ready');
    assert.equal(rows.goldCopy, undefined);
    assert.equal(rows.lockedRye, undefined, 'a Locked bar page reads as the classic');
  });

  test('the classic says where it is served: its origin bar first, bars with no spec too', async () => {
    const { classic } = await whatToMake('home');
    // Gold Room (origin), The Lions (no spec), Pale Moth (Locked, so unlisted). Not the venue.
    assert.equal(classic.served_count, 3);
    assert.equal(classic.served_at[0].name, name('Gold Room'));
    assert.deepEqual(classic.served_at.map((b) => b.name).sort(), [name('Gold Room'), name('Pale Moth'), name('The Lions')].sort());
    assert.equal(classic.spec_match, null);
  });

  test('a variation keeps its row and says what it changes; a riff says so', async () => {
    const rows = await whatToMake('home');
    assert.equal(rows.ryeVersion.spec_match, 'variation');
    assert.deepEqual(rows.ryeVersion.spec_note, { swaps: [{ to: name('Served Rye'), from: name('Served Bourbon'), base: false }] });
    assert.equal(rows.riff.spec_match, 'riff');
  });

  test('an app admin sees past the lock: the Locked version is a variation with its own row', async () => {
    const rows = await whatToMake('admin');
    assert.equal(rows.lockedRye.spec_match, 'variation');
    assert.equal(rows.classic.served_count, 2);
  });

  test("a venue's members see their own bar in the list; others never do", async () => {
    const member = await whatToMake('member');
    assert.ok(member.classic.served_at.some((b) => b.name === name('Long Island Bar')));
    assert.equal(member.venueCopy, undefined);
    const home = await whatToMake('home');
    assert.ok(!home.classic.served_at.some((b) => b.name === name('Long Island Bar')));
  });
});
