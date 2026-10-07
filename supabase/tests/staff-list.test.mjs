// The staff list in Library (bar_off_menu, migration
// 20261007100000_staff_list_fifty): ranked to 50, reordered in one call, and
// only by people who can build menus. Runs against the local stack only:
// `npm run test:security`.
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
  throw new Error(`Refusing to run staff list tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const users = {};
const ids = { items: [] };

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

async function order() {
  const { rows } = await db.query(
    'SELECT item_id FROM public.bar_off_menu WHERE bar_id = $1 AND sort_rank IS NOT NULL ORDER BY sort_rank',
    [ids.bar]
  );
  return rows.map((r) => r.item_id);
}

const reorder = (who, itemIds, barId = ids.bar) => users[who].client.rpc('set_staff_list_order', { p_bar_id: barId, p_item_ids: itemIds });

before(async () => {
  await db.connect();
  for (const label of ['maker', 'floor', 'outsider']) users[label] = await makeUser(label);

  ids.bar = (await serviceInsert('bars', { name: `Little Rye ${run}` })).id;
  ids.otherBar = (await serviceInsert('bars', { name: `Pale Moth ${run}` })).id;
  await serviceInsert('user_bars', { user_id: users.maker.id, bar_id: ids.bar, role_level: 35 });
  await serviceInsert('user_bars', { user_id: users.floor.id, bar_id: ids.bar, role_level: 20 });
  await serviceInsert('user_bars', { user_id: users.outsider.id, bar_id: ids.otherBar, role_level: 40 });

  for (const name of ['Martini', 'Negroni', 'Daiquiri']) {
    ids.items.push((await serviceInsert('items', { name: `${name} ${run}`, item_type: 'cocktail', is_catalog: true })).id);
  }
  for (const [i, id] of ids.items.entries()) await serviceInsert('bar_off_menu', { bar_id: ids.bar, item_id: id, sort_rank: i + 1 });
});

after(async () => {
  const like = `%${run}%`;
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('the staff list', () => {
  test('ranks run to 50, not past it', async () => {
    const [martini] = ids.items;
    await assert.rejects(db.query('UPDATE public.bar_off_menu SET sort_rank = 51 WHERE bar_id = $1 AND item_id = $2', [ids.bar, martini]), /bar_off_menu_rank_range/);
    await db.query('UPDATE public.bar_off_menu SET sort_rank = 50 WHERE bar_id = $1 AND item_id = $2', [ids.bar, martini]);
    await db.query('UPDATE public.bar_off_menu SET sort_rank = 1 WHERE bar_id = $1 AND item_id = $2', [ids.bar, martini]);
  });

  test('a Drink Creator reorders it in one call, swaps and all', async () => {
    const [martini, negroni, daiquiri] = ids.items;
    const { error } = await reorder('maker', [daiquiri, martini]);
    assert.ifError(error);
    assert.deepEqual(await order(), [daiquiri, martini]);
    const { rows } = await db.query('SELECT sort_rank FROM public.bar_off_menu WHERE bar_id = $1 AND item_id = $2', [ids.bar, negroni]);
    assert.equal(rows[0].sort_rank, null, 'left out of the order means unranked, still on the list');
  });

  test('floor staff can read it but not reorder it', async () => {
    const before = await order();
    const { data } = await users.floor.client.from('bar_off_menu').select('item_id').eq('bar_id', ids.bar);
    assert.equal(data.length, 3);
    const { error } = await reorder('floor', [...before].reverse());
    assert.match(error?.message ?? '', /opens at Drink Creator/);
    assert.deepEqual(await order(), before);
  });

  test('another bar’s admin can’t reorder it', async () => {
    const before = await order();
    const { error } = await reorder('outsider', [...before].reverse());
    assert.match(error?.message ?? '', /opens at Drink Creator/);
    assert.deepEqual(await order(), before);
  });

  test('refuses more than 50, duplicates, and drinks that aren’t on the list, leaving the order alone', async () => {
    const before = await order();
    const [martini] = ids.items;
    const tooMany = Array.from({ length: 51 }, () => randomUUID());
    for (const [list, message] of [
      [tooMany, /up to 50/],
      [[martini, martini], /only be in the staff list once/],
      [[martini, randomUUID()], /changed while you were ordering/],
    ]) {
      const { error } = await reorder('maker', list);
      assert.match(error?.message ?? '', message);
      assert.deepEqual(await order(), before);
    }
  });
});
