// A drink is on a menu once (20261206660000_menu_drinks_unique.sql): the
// unique index refuses a second live row, save_menu puts a drink sent twice on
// the menu once, a swap back in (the old row ending) still works, and the
// migration's delete keeps the earliest of a duplicate pair. Runs against the
// local stack.
//
//   supabase start && supabase db reset
//   npm run test:security

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run menu drink tests against a non-local API: ${status.API_URL}`);
}

const MIGRATION = readFileSync(new URL('../migrations/20261206660000_menu_drinks_unique.sql', import.meta.url), 'utf8');
const DEDUPE = MIGRATION.slice(MIGRATION.indexOf('DELETE FROM'), MIGRATION.indexOf('CREATE UNIQUE INDEX'));

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });
const ids = {};
let admin;

async function insert(table, row) {
  const { data, error } = await service.from(table).insert(row).select().single();
  if (error) throw new Error(`fixture insert into ${table} failed: ${error.message}`);
  return data;
}

const rowsOf = async (itemId) =>
  (await service.from('menu_drinks').select('id, off_at').eq('menu_id', ids.menu).eq('item_id', itemId)).data;

before(async () => {
  await db.connect();
  const email = `admin-${run}@menu-unique-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const signed = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signed.error) throw signed.error;
  admin = { id: data.user.id, client };
  ids.bar = (await insert('bars', { name: `Unique bar ${run}` })).id;
  await insert('user_bars', { user_id: admin.id, bar_id: ids.bar, role_level: 40 });
  ids.negroni = (await insert('items', { name: `Negroni ${run}`, item_type: 'cocktail', bar_id: ids.bar })).id;
  ids.collins = (await insert('items', { name: `Collins ${run}`, item_type: 'cocktail', bar_id: ids.bar })).id;
  ids.menu = (await insert('menus', { bar_id: ids.bar, name: `Unique ${run}`, starts_at: new Date(Date.now() - 86400000).toISOString() })).id;
  ids.section = (await insert('menu_sections', { menu_id: ids.menu, name: 'Stirred', sort_order: 0 })).id;
});

after(async () => {
  if (ids.menu) await service.from('menus').delete().eq('id', ids.menu);
  for (const id of [ids.negroni, ids.collins]) if (id) await service.from('items').delete().eq('id', id);
  if (ids.bar) await service.from('bars').delete().eq('id', ids.bar);
  if (admin) await service.auth.admin.deleteUser(admin.id);
  await db.end();
});

describe('a drink is on a menu once', () => {
  test('a second live row for the same drink is refused', async () => {
    const row = { menu_id: ids.menu, menu_section_id: ids.section, item_id: ids.negroni, sort_order: 0 };
    assert.ifError((await service.from('menu_drinks').insert(row)).error);
    const again = await service.from('menu_drinks').insert(row);
    assert.equal(again.error?.code, '23505');
    assert.equal((await rowsOf(ids.negroni)).length, 1);
  });

  test('a re-add with ON CONFLICT DO NOTHING is ignored', async () => {
    const { rowCount } = await db.query(
      `INSERT INTO public.menu_drinks (menu_id, menu_section_id, item_id, sort_order) VALUES ($1, $2, $3, 1)
       ON CONFLICT (menu_id, item_id) WHERE off_at IS NULL DO NOTHING`,
      [ids.menu, ids.section, ids.negroni]
    );
    assert.equal(rowCount, 0);
  });

  test('save_menu puts a drink sent twice on the menu once', async () => {
    const { error } = await admin.client.rpc('save_menu', {
      p_menu_id: ids.menu,
      p_name: `Unique ${run}`,
      p_cover_url: null,
      p_cover_position: 50,
      p_sections: [
        { id: ids.section, name: 'Stirred', min_items: 0, max_items: null, allowed_types: ['cocktail'], item_ids: [ids.negroni, ids.collins, ids.negroni, ids.collins] },
      ],
    });
    assert.ifError(error);
    assert.equal((await rowsOf(ids.negroni)).length, 1);
    assert.equal((await rowsOf(ids.collins)).length, 1);
  });

  test('a drink with a planned take-off can come back in as a new row', async () => {
    const soon = new Date(Date.now() + 86400000).toISOString();
    assert.ifError((await service.from('menu_drinks').update({ off_at: soon }).eq('menu_id', ids.menu).eq('item_id', ids.collins)).error);
    const back = await service
      .from('menu_drinks')
      .insert({ menu_id: ids.menu, menu_section_id: ids.section, item_id: ids.collins, sort_order: 5, on_from: soon });
    assert.ifError(back.error);
    assert.equal((await rowsOf(ids.collins)).length, 2);
  });

  test("the migration's delete keeps the earliest of a duplicate pair and nothing else", async () => {
    const menu = (await insert('menus', { bar_id: ids.bar, name: `Dupes ${run}`, starts_at: new Date(Date.now() - 86400000).toISOString() })).id;
    try {
      await db.query('BEGIN');
      await db.query('DROP INDEX public.menu_drinks_menu_item_live_key');
      const [first, second, other] = [randomUUID(), randomUUID(), randomUUID()];
      const add = (id, item, at) =>
        db.query('INSERT INTO public.menu_drinks (id, menu_id, item_id, sort_order, created_at) VALUES ($1, $2, $3, 0, $4)', [id, menu, item, at]);
      await add(second, ids.negroni, '2026-01-02T00:00:00Z');
      await add(first, ids.negroni, '2026-01-01T00:00:00Z');
      await add(other, ids.collins, '2026-01-03T00:00:00Z');
      const { rowCount } = await db.query(DEDUPE);
      assert.equal(rowCount, 1);
      const { rows } = await db.query('SELECT id FROM public.menu_drinks WHERE menu_id = $1 ORDER BY id', [menu]);
      assert.deepEqual(rows.map((r) => r.id).sort(), [first, other].sort());
    } finally {
      await db.query('ROLLBACK');
      await service.from('menus').delete().eq('id', menu);
    }
  });

  test('merging two copies of a drink live on one menu keeps one row, the record and no take-off', async () => {
    const a = (await insert('items', { name: `Keep ${run}`, item_type: 'cocktail', bar_id: ids.bar })).id;
    const b = (await insert('items', { name: `Copy ${run}`, item_type: 'cocktail', bar_id: ids.bar })).id;
    const menu = (await insert('menus', { bar_id: ids.bar, name: `Merge ${run}`, starts_at: new Date(Date.now() - 86400000).toISOString() })).id;
    try {
      const section = (await insert('menu_sections', { menu_id: menu, name: 'Any', sort_order: 0 })).id;
      await insert('menu_drinks', { menu_id: menu, menu_section_id: section, item_id: a, sort_order: 0 });
      await insert('menu_drinks', { menu_id: menu, menu_section_id: section, item_id: b, sort_order: 1 });
      await db.query('SELECT private.merge_item($1, $2)', [b, a]);
      const { rows } = await db.query('SELECT item_id FROM public.menu_drinks WHERE menu_id = $1', [menu]);
      assert.deepEqual(rows.map((r) => r.item_id), [a]);
      const gone = await db.query('SELECT 1 FROM public.menu_drinks_removed WHERE menu_id = $1', [menu]);
      assert.equal(gone.rowCount, 0, 'the drink stayed on the menu');
      const merge = await db.query('SELECT snapshot -> \'dropped\' AS dropped FROM private.item_merges WHERE from_id = $1', [b]);
      assert.equal(merge.rows[0].dropped[0].table, 'public.menu_drinks');
    } finally {
      await service.from('menus').delete().eq('id', menu);
      await service.from('items').delete().eq('id', a);
      await service.from('items').delete().eq('id', b);
    }
  });
});
