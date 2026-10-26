// Snap a bottle matched on the server (20261121100000_match_ingredients.sql):
// match_ingredients hands back the catalog rows the phone's matcher lands
// on, shared ones for anyone signed in and a venue's own only for its staff
// (and only those their role sees). Its keys are the phone's keys.
// Runs against the local stack only: `npm run test:security`.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const status = JSON.parse(execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run match-ingredients tests against a non-local API: ${status.API_URL}`);
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
  const email = `${label}-${run}@match-ingredients-test.local`;
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

const match = (who, readings, venueId) => users[who].client.rpc('match_ingredients', { p_readings: readings, ...(venueId ? { p_venue_id: venueId } : {}) });
const names = (rows) => new Set(rows.map((r) => r.name));

before(async () => {
  await db.connect();
  for (const label of ['admin', 'bartender', 'outsider', 'home']) users[label] = await makeUser(label);
  ids.bar = (await insert('bars', { name: `Match bar ${run}` })).id;
  ids.otherBar = (await insert('bars', { name: `Other match bar ${run}` })).id;
  await insert('user_bars', { user_id: users.admin.id, bar_id: ids.bar, role_level: 40 });
  await insert('user_bars', { user_id: users.bartender.id, bar_id: ids.bar, role_level: 20 });
  await insert('user_bars', { user_id: users.outsider.id, bar_id: ids.otherBar, role_level: 40 });
  ids.kind = (await insert('items', { name: `Zephyrine bitters ${run}`, item_type: 'ingredient' })).id;
  ids.shared = (await insert('items', { name: `Zephyrine Amber Bitters ${run}`, item_type: 'ingredient', generic_id: ids.kind })).id;
  ids.own = (await insert('items', { name: `House Zephyrine Bitters ${run}`, item_type: 'ingredient', bar_id: ids.bar, generic_id: ids.kind })).id;
  ids.secret = (await insert('items', { name: `Owner Zephyrine Bitters ${run}`, item_type: 'ingredient', bar_id: ids.bar, generic_id: ids.kind, override_visibility_level: 40 })).id;
  ids.otherOwn = (await insert('items', { name: `Other Zephyrine Bitters ${run}`, item_type: 'ingredient', bar_id: ids.otherBar, generic_id: ids.kind })).id;
  await insert('ingredient_aliases', { key: `zephyr bitters ${run}`, item_id: ids.shared });
  ids.drink = (await insert('items', { name: `Zephyrine Sour ${run}`, item_type: 'cocktail' })).id;
});

after(async () => {
  await service.from('ingredient_aliases').delete().eq('item_id', ids.shared);
  for (const id of [ids.drink, ids.otherOwn, ids.secret, ids.own, ids.shared, ids.kind]) if (id) await service.from('items').delete().eq('id', id);
  for (const id of [ids.bar, ids.otherBar]) if (id) await service.from('bars').delete().eq('id', id);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
  await db.end();
});

describe('match_ingredients', () => {
  test('signed out, nothing', async () => {
    const { error } = await anon.rpc('match_ingredients', { p_readings: [{ name: 'Gin' }] });
    assert.ok(error, 'anon may not call it');
  });

  test('a label finds the shared bottle, its kind, how many name the kind, and an alias', async () => {
    const { data, error } = await match('home', [{ name: `Zephyrine Amber Bitters ${run}`, brand: 'Zephyrine', kind: 'Bitters' }, { name: `Zephyr Bitters ${run}` }]);
    assert.ifError(error);
    const first = data.filter((r) => r.reading === 0);
    assert.equal(first[0].id, ids.shared, 'the same name scores best');
    assert.equal(first[0].score, 1);
    const kind = first.find((r) => r.id === ids.kind);
    assert.ok(kind, 'its kind comes along');
    assert.equal(kind.kind_of, 1, 'shared rows naming it, venues’ own left out');
    const alias = data.find((r) => r.reading === 1 && r.id === ids.shared);
    assert.equal(alias?.alias, `zephyr bitters ${run}`);
  });

  test('a venue’s own rows only for its staff, and only those their role sees', async () => {
    const readings = [{ name: `Zephyrine bitters ${run}` }];
    const admin = await match('admin', readings, ids.bar);
    assert.ifError(admin.error);
    assert.ok(names(admin.data).has(`House Zephyrine Bitters ${run}`));
    assert.ok(names(admin.data).has(`Owner Zephyrine Bitters ${run}`));
    assert.ok(!names(admin.data).has(`Other Zephyrine Bitters ${run}`), 'never another venue’s');
    assert.equal(admin.data.find((r) => r.id === ids.kind)?.kind_of, 3, 'shared and this venue’s');

    const bartender = await match('bartender', readings, ids.bar);
    assert.ifError(bartender.error);
    assert.ok(names(bartender.data).has(`House Zephyrine Bitters ${run}`));
    assert.ok(!names(bartender.data).has(`Owner Zephyrine Bitters ${run}`), 'RLS decides: above a bartender’s level');

    for (const [who, venue] of [['outsider', ids.bar], ['home', ids.bar], ['admin', null]]) {
      const res = await match(who, readings, venue);
      assert.ifError(res.error);
      assert.ok(![...names(res.data)].some((n) => n.startsWith('House') || n.startsWith('Owner')), `${who} with ${venue}: no venue rows`);
    }
  });

  test('the candidate search behind it leaks no venue ids to a stranger', async () => {
    await db.query('BEGIN');
    try {
      await db.query(`SET LOCAL ROLE authenticated`);
      await db.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: users.outsider.id, role: 'authenticated' })]);
      const { rows } = await db.query('SELECT id FROM private.match_candidates($1::jsonb, $2)', [JSON.stringify([{ name: `House Zephyrine Bitters ${run}` }]), ids.bar]);
      assert.ok(!rows.some((r) => [ids.own, ids.secret].includes(r.id)));
    } finally {
      await db.query('ROLLBACK');
    }
  });

  test('bad input is refused', async () => {
    assert.ok((await match('home', { name: 'Gin' })).error, 'not a list');
    assert.ok((await match('home', Array.from({ length: 41 }, () => ({ name: 'Gin' })))).error, 'too many');
    const odd = await match('home', [{ name: 42 }, {}, { name: '' }]);
    assert.ifError(odd.error);
    assert.equal(odd.data.length, 0, 'readings without a name find nothing');
  });

  test('the database keys names as the phone does (lib/match.ts matchKey)', async () => {
    const want = {
      'Tanqueray Nº Ten': 'tanqueray no ten',
      'Hampden Estate 8 Years Old': 'hampden estate 8yo',
      'Crème de Cassis & Co': 'creme de cassis and co',
      'Smith’s Ø Æble': 'smiths o ble',
      'n° 3 gin': 'no 3 gin',
      'Yellow Chartreuse 12-year-old': 'yellow chartreuse 12yo',
    };
    const { rows } = await db.query('SELECT x, public.match_key(x) AS key, public.match_words(x) AS words FROM unnest($1::text[]) x', [Object.keys(want)]);
    for (const r of rows) assert.equal(r.key, want[r.x], r.x);
    assert.deepEqual(rows.find((r) => r.x === 'Crème de Cassis & Co').words, ['creme', 'cassis', 'co']);
  });

  test('signed out, drink pages still read (planning on items inlines the key functions as anon)', async () => {
    // A planner error, not a row count: anon sees no items of its own, and every read below plans on items.
    for (const [view, columns] of [['published_items', 'id, name'], ['app_recipe_presentation', 'id, recipe_item_id']]) {
      const { error } = await anon.from(view).select(columns).limit(5);
      assert.ifError(error);
    }
    const { error } = await anon.from('published_items').select('id').eq('id', ids.drink);
    assert.ifError(error);
  });

  test('the service role still writes ingredients (the indexes run the key functions as the writer)', async () => {
    const { data, error } = await service.from('items').insert({ name: `Zephyrine Service Row ${run}`, item_type: 'ingredient' }).select('id').single();
    assert.ifError(error);
    await service.from('items').delete().eq('id', data.id);
  });

  test('app roles can run the key functions, so they inline and the indexes are used whoever plans first', async () => {
    for (const fn of ['match_fold', 'match_key', 'match_words']) {
      for (const role of ['anon', 'authenticated', 'service_role']) {
        const { rows } = await db.query(`SELECT has_function_privilege($1, $2, 'execute') AS ok`, [role, `public.${fn}(text)`]);
        assert.ok(rows[0].ok, `${role} on ${fn}`);
      }
    }
  });
});
