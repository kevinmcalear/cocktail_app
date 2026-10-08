// My Bar's "can make" and an ingredient's "Used in" in SQL
// (supabase/migrations/20261008340000_my_bar_rpc.sql, and the kind-of tree,
// two away and uses from 20261009950000_my_bar_kinds.sql). The can-make cases are
// the ones lib/canMake.check.ts held when this ran on the phone. Both
// functions run as the caller, so they must return nothing the caller
// couldn't already read. Local stack only: `npm run test:security`.
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
  throw new Error(`Refusing to run my bar tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const ids = {};
const users = {};

async function makeUser(label) {
  const email = `${label}-${run}@my-bar-test.local`;
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

const item = async (key, row) => {
  ids[key] = (await serviceInsert('items', { ...row, name: `${row.name} ${run}` })).id;
};

/** Lines as [ingredient key, generic key or null, optional]. */
async function recipe(key, lines) {
  for (const [i, [ingredient, generic = null, optional = false]] of lines.entries()) {
    await serviceInsert('recipes', {
      recipe_item_id: ids[key],
      ingredient_item_id: ids[ingredient],
      parent_ingredient_id: generic ? ids[generic] : null,
      is_optional: optional,
      amount: 30,
      unit: 'ml',
      sort_order: i,
    });
  }
}

/** Puts exactly these on the user's shelf, through their own client. */
async function shelve(user, keys) {
  await db.query('DELETE FROM public.home_bar_items WHERE user_id = $1', [users[user].id]);
  for (const key of keys) {
    const { error } = await users[user].client.from('home_bar_items').insert({ item_id: ids[key] });
    assert.ifError(error);
  }
}

/** This run's drinks in my_bar_drinks: { canMake: [keys], away: { drink key: missing key }, two: { drink key: [missing keys] } }. */
async function myBar(user, args = {}) {
  const { data, error } = await users[user].client.rpc('my_bar_drinks', args);
  assert.ifError(error);
  const key = Object.fromEntries(Object.entries(ids).map(([k, v]) => [v, k]));
  const mine = data.filter((r) => key[r.id]);
  return {
    canMake: mine.filter((r) => !r.missing_id).map((r) => key[r.id]).sort(),
    away: Object.fromEntries(mine.filter((r) => r.missing_id && !r.missing2_id).map((r) => [key[r.id], key[r.missing_id] ?? r.missing_id])),
    two: Object.fromEntries(mine.filter((r) => r.missing2_id).map((r) => [key[r.id], [key[r.missing_id], key[r.missing2_id]].sort()])),
    uses: Object.fromEntries(mine.map((r) => [key[r.id], r.uses.map((u) => key[u]).sort()])),
    rows: mine,
  };
}

before(async () => {
  await db.connect();
  for (const label of ['home', 'other', 'member']) users[label] = await makeUser(label);

  for (const name of ['gin', 'tanqueray', 'sweet-vermouth', 'carpano', 'campari', 'dry-vermouth', 'olive', 'bourbon', 'rye', 'lemon', 'honey', 'water', 'honey-syrup', 'a', 'b']) {
    await item(name, { name, item_type: 'ingredient' });
  }
  for (const name of ['negroni', 'martini', 'gold-rush', 'bees-knees', 'old-pal', 'empty', 'loop']) await item(name, { name, item_type: 'cocktail' });
  // The kind-of tree: Woodford is a Bourbon, a Whiskey, a Spirit; Rye Whiskey is another Whiskey; Lime and Yuzu are Citrus.
  for (const name of ['spirit', 'citrus']) await item(name, { name, item_type: 'ingredient', ingredient_role: 'generic' });
  await item('whiskey', { name: 'whiskey', item_type: 'ingredient', ingredient_role: 'generic', generic_id: ids.spirit });
  await item('bourbon-style', { name: 'bourbon style', item_type: 'ingredient', ingredient_role: 'generic', generic_id: ids.whiskey });
  await item('rye-whiskey', { name: 'rye whiskey', item_type: 'ingredient', ingredient_role: 'generic', generic_id: ids.whiskey });
  await item('woodford', { name: 'woodford', item_type: 'ingredient', ingredient_role: 'product', generic_id: ids['bourbon-style'] });
  await item('buffalo', { name: 'buffalo', item_type: 'ingredient', ingredient_role: 'product', generic_id: ids['bourbon-style'] });
  for (const name of ['lime', 'yuzu']) await item(name, { name, item_type: 'ingredient', ingredient_role: 'generic', generic_id: ids.citrus });
  for (const name of ['whiskey-sour', 'rye-sour', 'buffalo-sour', 'any-spirit', 'yuzu-sour']) await item(name, { name, item_type: 'cocktail' });
  await recipe('whiskey-sour', [['whiskey'], ['lemon']]);
  await recipe('rye-sour', [['rye-whiskey'], ['lemon']]);
  await recipe('buffalo-sour', [['buffalo'], ['lemon']]);
  await recipe('any-spirit', [['spirit'], ['lime']]);
  await recipe('yuzu-sour', [['yuzu'], ['lemon']]);
  await recipe('negroni', [['tanqueray', 'gin'], ['carpano', 'sweet-vermouth'], ['campari']]);
  await recipe('martini', [['gin'], ['dry-vermouth'], ['olive', null, true]]);
  await recipe('gold-rush', [['bourbon'], ['lemon'], ['honey-syrup']]);
  await recipe('bees-knees', [['gin'], ['lemon'], ['honey-syrup']]);
  await recipe('old-pal', [['rye'], ['dry-vermouth'], ['campari']]);
  await recipe('honey-syrup', [['honey'], ['water']]);
  // A recipe cycle: a needs b, b needs a. The loop drink needs a.
  await recipe('a', [['b']]);
  await recipe('b', [['a']]);
  await recipe('loop', [['a']]);

  // A bar keeping a gin-and-Campari drink to its staff, and one its members (role 20) see with the brand masked.
  ids.bar = (await serviceInsert('bars', { name: `My Bar Test ${run}` })).id;
  await serviceInsert('user_bars', { user_id: users.member.id, bar_id: ids.bar, role_level: 20 });
  await item('staffOnly', { name: 'Staff Only', item_type: 'cocktail', bar_id: ids.bar, override_visibility_level: 40 });
  await recipe('staffOnly', [['gin'], ['campari']]);
  await item('house', { name: 'House Negroni', item_type: 'cocktail', bar_id: ids.bar });
  await recipe('house', [['tanqueray', 'gin'], ['campari']]);
});

after(async () => {
  const like = `%${run}%`;
  for (const user of Object.values(users)) await db.query('DELETE FROM public.home_bar_items WHERE user_id = $1', [user.id]);
  const { rows } = await db.query('SELECT id FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM private.item_flavor_jobs WHERE item_id = ANY($1)', [rows.map((r) => r.id)]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('my_bar_drinks', () => {
  test('is for signed-in people only', async () => {
    assert.ok((await anon.rpc('my_bar_drinks')).error);
  });

  test('a generic on the shelf covers a branded line, and optional lines never block', async () => {
    await shelve('home', ['gin', 'sweet-vermouth', 'dry-vermouth']);
    const r = await myBar('home');
    assert.deepEqual(r.canMake, ['martini']);
    assert.equal(r.away.negroni, 'campari');
    assert.ok(!r.canMake.includes('staffOnly') && !('staffOnly' in r.away), 'a drink the caller cannot read is never listed');
  });

  test('a brand covers a generic line, and house-made syrups count once their recipe is covered', async () => {
    await shelve('home', ['tanqueray', 'carpano', 'campari', 'honey', 'water', 'lemon', 'dry-vermouth']);
    const r = await myBar('home');
    assert.deepEqual(r.canMake, ['bees-knees', 'martini', 'negroni']);
    assert.equal(r.away['gold-rush'], 'bourbon');
    assert.equal(r.away['old-pal'], 'rye');
    assert.ok(!r.canMake.includes('empty') && !('empty' in r.away), 'a drink with no lines never matches');
  });

  test('a missing syrup asks for what its recipe is missing, never the syrup', async () => {
    await shelve('home', ['gin', 'lemon', 'honey']);
    const r = await myBar('home');
    assert.deepEqual(r.canMake, []);
    assert.equal(r.away['bees-knees'], 'water');
    assert.equal(r.away.martini, 'dry-vermouth');
    assert.ok(!Object.values(r.away).includes('honey-syrup'));
    await shelve('home', ['gin', 'lemon']);
    assert.ok(!('bees-knees' in (await myBar('home')).away), 'honey and water are two bottles');
  });

  test('a recipe cycle stops instead of looping', async () => {
    await shelve('home', []);
    const r = await myBar('home');
    assert.ok(!r.canMake.includes('loop'));
  });

  test('works from the caller\'s own shelf only', async () => {
    await shelve('home', ['gin', 'sweet-vermouth', 'dry-vermouth']);
    await shelve('other', []);
    const r = await myBar('other');
    assert.deepEqual(r.canMake, []);
    const { data } = await users.other.client.from('home_bar_items').select('item_id');
    assert.deepEqual(data, [], 'and cannot read anyone else\'s');
  });

  test('a member sees the masked line: their generic covers it, the brand is never shown', async () => {
    await shelve('member', ['gin']);
    const r = await myBar('member');
    assert.equal(r.away.house, 'campari');
    await shelve('home', ['gin']);
    assert.ok(!('house' in (await myBar('home')).away), 'a non-member cannot read the bar drink');
  });

  test('a bottle covers lines for anything it is a kind of, however far up, and other bottles of its style', async () => {
    await shelve('home', ['woodford', 'lemon', 'lime']);
    const r = await myBar('home');
    for (const drink of ['whiskey-sour', 'buffalo-sour', 'any-spirit']) assert.ok(r.canMake.includes(drink), drink);
    assert.deepEqual(r.uses['whiskey-sour'], ['lemon', 'woodford'], 'uses names the shelf rows a drink needs');
  });

  test('but not a sibling style, and a plain ingredient covers no siblings', async () => {
    await shelve('home', ['woodford', 'lemon', 'lime']);
    const r = await myBar('home');
    assert.equal(r.away['rye-sour'], 'rye-whiskey', 'bourbon is a whiskey, but a rye line wants rye, and says so');
    assert.equal(r.away['yuzu-sour'], 'yuzu', 'a lime is citrus, but covers no yuzu');
  });

  test('two away only when asked, so older apps see the same rows', async () => {
    await shelve('home', ['campari']);
    const one = await myBar('home');
    assert.ok(!('old-pal' in one.away) && !('old-pal' in one.two));
    const two = await myBar('home', { p_two_away: true });
    assert.deepEqual(two.two['old-pal'], ['dry-vermouth', 'rye']);
    assert.equal(two.away.negroni, undefined, 'the negroni needs gin and vermouth: two');
    assert.deepEqual(two.two.negroni, ['gin', 'sweet-vermouth']);
  });

  test('pages A to Z after a name and id', async () => {
    await shelve('home', ['tanqueray', 'carpano', 'campari', 'honey', 'water', 'lemon', 'dry-vermouth']);
    const all = (await users.home.client.rpc('my_bar_drinks')).data;
    const { data: first } = await users.home.client.rpc('my_bar_drinks', { p_limit: 2 });
    assert.deepEqual(first.map((r) => r.id), all.slice(0, 2).map((r) => r.id));
    const { data: next } = await users.home.client.rpc('my_bar_drinks', { p_after_name: first[1].name, p_after_id: first[1].id, p_limit: 2 });
    assert.deepEqual(next.map((r) => r.id), all.slice(2, 4).map((r) => r.id));
  });
});

describe('ingredient_used_in', () => {
  const usedIn = async (user, key) => {
    const { data, error } = await (user ? users[user].client : anon).rpc('ingredient_used_in', { p_ingredient_id: ids[key] });
    if (!user) return { error };
    assert.ifError(error);
    const key2 = Object.fromEntries(Object.entries(ids).map(([k, v]) => [v, k]));
    return data.map((r) => key2[r.id]).filter(Boolean).sort();
  };

  test('is for signed-in people only', async () => {
    assert.ok((await usedIn(null, 'campari')).error);
  });

  test('the cocktails whose line shows the ingredient, never preps or drinks the caller cannot read', async () => {
    assert.deepEqual(await usedIn('home', 'campari'), ['negroni', 'old-pal']);
    assert.deepEqual(await usedIn('home', 'honey'), [], 'honey syrup is a prep, listed on its card');
    assert.deepEqual(await usedIn('member', 'campari'), ['house', 'negroni', 'old-pal']);
  });

  test('as the caller\'s recipe view shows it: a masked line counts for its generic, not the brand', async () => {
    assert.deepEqual(await usedIn('home', 'tanqueray'), ['negroni']);
    assert.deepEqual(await usedIn('home', 'gin'), ['bees-knees', 'martini']);
    assert.deepEqual(await usedIn('member', 'tanqueray'), ['negroni']);
    assert.deepEqual(await usedIn('member', 'gin'), ['bees-knees', 'house', 'martini']);
  });
});
