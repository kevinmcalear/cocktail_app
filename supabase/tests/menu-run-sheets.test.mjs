// Run sheets (20261016900000_menu_run_sheets): serves per menu drink, the
// menu's guest venue and brands, swaps for this menu only, and who brings
// each thing. Access mirrors menu_drinks: the menu's readers read, its
// editors write, nobody else sees a thing. save_menu keeps a staying drink's
// row, so its serves and swaps survive an edit.
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
  throw new Error(`Refusing to run run sheet tests against a non-local API: ${status.API_URL}`);
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

const menuDrink = (menu_id, item_id, sort_order = 0) => serviceInsert('menu_drinks', { menu_id, item_id, sort_order });

before(async () => {
  await db.connect();
  for (const label of ['maker', 'floor', 'outsider']) users[label] = await makeUser(label);

  ids.bar = (await serviceInsert('bars', { name: `Caretakers ${run}` })).id;
  ids.otherBar = (await serviceInsert('bars', { name: `Elsewhere ${run}` })).id;
  await serviceInsert('user_bars', { user_id: users.maker.id, bar_id: ids.bar, role_level: 35 });
  await serviceInsert('user_bars', { user_id: users.floor.id, bar_id: ids.bar, role_level: 20 });
  await serviceInsert('user_bars', { user_id: users.outsider.id, bar_id: ids.otherBar, role_level: 40 });

  ids.guestPage = (await serviceInsert('profiles', { kind: 'bar', handle: `littlerye.${run}`, display_name: `Little Rye ${run}`, is_public: true })).id;
  ids.makerPage = (await serviceInsert('profiles', { kind: 'maker', handle: `millash.${run}`, display_name: `Mill and Ash ${run}`, is_public: true })).id;

  const item = async (name, item_type) => (await serviceInsert('items', { name: `${name} ${run}`, item_type, bar_id: ids.bar })).id;
  ids.negroni = await item('Negroni', 'cocktail');
  ids.martini = await item('Martini', 'cocktail');
  ids.gin = await item('London dry gin', 'ingredient');
  ids.millAsh = await item('Mill and Ash Gin', 'ingredient');
  ids.campari = await item('Campari', 'ingredient');

  ids.menu = (await serviceInsert('menus', { name: `Halloween ${run}`, bar_id: ids.bar })).id;
  ids.otherMenu = (await serviceInsert('menus', { name: `Other ${run}`, bar_id: ids.bar })).id;
  ids.negroniRow = (await menuDrink(ids.menu, ids.negroni, 0)).id;
  ids.martiniRow = (await menuDrink(ids.menu, ids.martini, 1)).id;
  ids.otherParty = (await serviceInsert('menu_run_parties', { menu_id: ids.otherMenu, kind: 'brand', name: 'Elsewhere brand' })).id;
});

after(async () => {
  const like = `%${run}%`;
  await db.query('DELETE FROM public.menus WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.profiles WHERE handle LIKE $1', [like]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('a menu editor builds the run sheet', () => {
  test('serves, parties, swaps and owners', async () => {
    const maker = users.maker.client;
    const serves = await maker.from('menu_drinks').update({ serves: 200 }).eq('id', ids.negroniRow).select('serves');
    assert.ifError(serves.error);
    assert.equal(serves.data[0].serves, 200);

    const guest = await maker.from('menu_run_parties').insert({ menu_id: ids.menu, kind: 'guest', name: 'Little Rye', profile_id: ids.guestPage }).select().single();
    assert.ifError(guest.error);
    ids.guest = guest.data.id;
    const brand = await maker.from('menu_run_parties').insert({ menu_id: ids.menu, kind: 'brand', name: 'Mill and Ash', profile_id: ids.makerPage, sort_order: 1 }).select().single();
    assert.ifError(brand.error);
    ids.brand = brand.data.id;
    const second = await maker.from('menu_run_parties').insert({ menu_id: ids.menu, kind: 'brand', name: 'Harbour Scotch', sort_order: 2 }).select().single();
    assert.ifError(second.error, 'brands are many, and a profile link is optional');
    ids.harbour = second.data.id;

    const swap = await maker.from('menu_run_swaps').insert({ menu_drink_id: ids.negroniRow, from_item_id: ids.gin, to_item_id: ids.millAsh }).select().single();
    assert.ifError(swap.error);

    const owners = await maker.from('menu_run_owners').upsert([
      { menu_id: ids.menu, item_id: ids.millAsh, party_id: ids.brand },
      { menu_id: ids.menu, item_id: ids.campari, party_id: null },
    ]);
    assert.ifError(owners.error);
  });

  test('serves start at 1, and a menu has one guest venue', async () => {
    const zero = await users.maker.client.from('menu_drinks').update({ serves: 0 }).eq('id', ids.martiniRow);
    assert.equal(zero.error?.code, '23514');
    const big = await users.maker.client.from('menu_drinks').update({ serves: 6969 }).eq('id', ids.martiniRow).select('serves');
    assert.ifError(big.error);
    const another = await users.maker.client.from('menu_run_parties').insert({ menu_id: ids.menu, kind: 'guest', name: 'Second guest' });
    assert.equal(another.error?.code, '23505');
  });

  test('a guest links to a bar page and a brand to a maker page', async () => {
    const wrong = await users.maker.client.from('menu_run_parties').insert({ menu_id: ids.menu, kind: 'brand', name: 'Not a maker', profile_id: ids.guestPage });
    assert.match(wrong.error?.message ?? '', /maker's page/);
  });

  test("an owner is one of this menu's parties", async () => {
    const res = await users.maker.client.from('menu_run_owners').upsert({ menu_id: ids.menu, item_id: ids.gin, party_id: ids.otherParty });
    assert.equal(res.error?.code, '23503');
  });

  test('a swap never changes the library spec', async () => {
    const { rows } = await db.query('SELECT count(*)::int AS n FROM public.recipes WHERE recipe_item_id = $1', [ids.negroni]);
    assert.equal(rows[0].n, 0);
  });
});

describe('who reads and writes', () => {
  test('the menu team reads everything', async () => {
    const floor = users.floor.client;
    const [drinks, parties, swaps, owners] = await Promise.all([
      floor.from('menu_drinks').select('id, serves').eq('menu_id', ids.menu),
      floor.from('menu_run_parties').select('id').eq('menu_id', ids.menu),
      floor.from('menu_run_swaps').select('id').eq('menu_drink_id', ids.negroniRow),
      floor.from('menu_run_owners').select('item_id').eq('menu_id', ids.menu),
    ]);
    for (const r of [drinks, parties, swaps, owners]) assert.ifError(r.error);
    assert.equal(drinks.data.find((d) => d.id === ids.negroniRow).serves, 200);
    assert.equal(parties.data.length, 3);
    assert.equal(swaps.data.length, 1);
    assert.equal(owners.data.length, 2);
  });

  test("someone who can read but not edit the menu changes nothing", async () => {
    const floor = users.floor.client;
    const serves = await floor.from('menu_drinks').update({ serves: 1 }).eq('id', ids.negroniRow).select('id');
    assert.equal(serves.data?.length ?? 0, 0);
    const party = await floor.from('menu_run_parties').insert({ menu_id: ids.menu, kind: 'brand', name: 'Sneaky' });
    assert.equal(party.error?.code, '42501');
    const swap = await floor.from('menu_run_swaps').insert({ menu_drink_id: ids.martiniRow, from_item_id: ids.gin, to_item_id: ids.millAsh });
    assert.equal(swap.error?.code, '42501');
    const owner = await floor.from('menu_run_owners').insert({ menu_id: ids.menu, item_id: ids.gin, party_id: null });
    assert.equal(owner.error?.code, '42501');
    const gone = await floor.from('menu_run_parties').delete().eq('id', ids.brand).select('id');
    assert.equal(gone.data?.length ?? 0, 0);
    const { rows } = await db.query('SELECT count(*)::int AS n FROM public.menu_run_parties WHERE menu_id = $1', [ids.menu]);
    assert.equal(rows[0].n, 3);
  });

  test("another bar's team sees nothing and writes nothing", async () => {
    const out = users.outsider.client;
    const [parties, swaps, owners] = await Promise.all([
      out.from('menu_run_parties').select('id').eq('menu_id', ids.menu),
      out.from('menu_run_swaps').select('id').eq('menu_drink_id', ids.negroniRow),
      out.from('menu_run_owners').select('item_id').eq('menu_id', ids.menu),
    ]);
    for (const r of [parties, swaps, owners]) {
      assert.ifError(r.error);
      assert.equal(r.data.length, 0);
    }
    const insert = await out.from('menu_run_parties').insert({ menu_id: ids.menu, kind: 'brand', name: 'Intruder' });
    assert.equal(insert.error?.code, '42501');
    const swap = await out.from('menu_run_swaps').insert({ menu_drink_id: ids.martiniRow, from_item_id: ids.campari, to_item_id: ids.gin });
    assert.equal(swap.error?.code, '42501');
  });

  test('signed out: no access at all', async () => {
    for (const table of ['menu_run_parties', 'menu_run_swaps', 'menu_run_owners']) {
      const res = await anon.from(table).select('*').limit(1);
      assert.equal(res.error?.code, '42501', table);
    }
  });
});

describe('keeping the plan', () => {
  test('removing a party hands its things back to the host', async () => {
    const res = await users.maker.client.from('menu_run_parties').delete().eq('id', ids.brand);
    assert.ifError(res.error);
    const { rows } = await db.query('SELECT party_id FROM public.menu_run_owners WHERE menu_id = $1 AND item_id = $2', [ids.menu, ids.millAsh]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].party_id, null);
  });

  test('saving the menu keeps serves and swaps for drinks that stay, and drops them for drinks taken off', async () => {
    const save = (itemIds) =>
      users.maker.client.rpc('save_menu', {
        p_menu_id: ids.menu,
        p_name: `Halloween ${run}`,
        p_cover_url: null,
        p_cover_position: null,
        p_sections: [{ name: 'Cocktails', allowed_types: ['cocktail'], item_ids: itemIds }],
      });
    const first = await save([ids.martini, ids.negroni]);
    assert.ifError(first.error);
    const { rows } = await db.query('SELECT id, item_id, serves, sort_order FROM public.menu_drinks WHERE menu_id = $1 ORDER BY sort_order', [ids.menu]);
    assert.deepEqual(rows.map((r) => r.item_id), [ids.martini, ids.negroni], 'the new order');
    assert.equal(rows[1].id, ids.negroniRow, 'the same row');
    assert.equal(rows[1].serves, 200);
    const swaps = await db.query('SELECT count(*)::int AS n FROM public.menu_run_swaps WHERE menu_drink_id = $1', [ids.negroniRow]);
    assert.equal(swaps.rows[0].n, 1);

    const second = await save([ids.martini]);
    assert.ifError(second.error);
    const left = await db.query('SELECT count(*)::int AS n FROM public.menu_run_swaps WHERE menu_drink_id = $1', [ids.negroniRow]);
    assert.equal(left.rows[0].n, 0);
    const kept = await db.query('SELECT serves FROM public.menu_drinks WHERE id = $1', [ids.martiniRow]);
    assert.equal(kept.rows[0].serves, 6969);
  });
});
