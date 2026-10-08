// What each ingredient is (20261008900000_ingredient_roles.sql): bottles,
// house preps and styles; a prep made from a bottle stays a kind of a style;
// merging keeps that shape.
//
//   supabase start && supabase db reset
//   npm run test:security

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
  throw new Error(`Refusing to run ingredient tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });
const ids = {};
const users = {};

// A name only this run uses, so parallel runs and seeds never collide.
const n = (name) => `${name} ${run}`;

async function item(row) {
  const { rows } = await db.query(
    `INSERT INTO public.items (name, item_type, generic_id, made_from_id, brand_maker, abv, ingredient_role, is_core, bar_id)
     VALUES ($1, 'ingredient', $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, generic_id, made_from_id, ingredient_role`,
    [n(row.name), row.generic ?? null, row.madeFrom ?? null, row.maker ?? null, row.abv ?? null, row.role ?? null, row.core ?? false, row.bar ?? null]
  );
  return rows[0];
}

async function get(id) {
  const { rows } = await db.query('SELECT id, generic_id, made_from_id, ingredient_role, brand_maker, abv FROM public.items WHERE id = $1', [id]);
  return rows[0];
}

before(async () => {
  await db.connect();
  const { data: bar, error } = await service.from('bars').insert({ name: `Roles ${run}`, slug: `roles-${run}` }).select('id').single();
  if (error) throw error;
  ids.bar = bar.id;
  const { data: u, error: userError } = await service.auth.admin.createUser({ email: `roles-${run}@security-test.local`, password: PASSWORD, email_confirm: true });
  if (userError) throw userError;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  await client.auth.signInWithPassword({ email: `roles-${run}@security-test.local`, password: PASSWORD });
  users.member = { id: u.user.id, client };
  await service.from('user_bars').insert({ user_id: u.user.id, bar_id: ids.bar, role_level: 40 });
  ids.bourbon = (await item({ name: 'Bourbon', core: true, role: 'generic' })).id;
  ids.bottle = (await item({ name: 'Buffalo Trace', generic: ids.bourbon, maker: 'Buffalo Trace', abv: 40 })).id;
});

after(async () => {
  await db.query("DELETE FROM public.items WHERE name LIKE '%' || $1", [run]);
  if (ids.bar) await service.from('bars').delete().eq('id', ids.bar);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
  await db.end();
});

describe('ingredient roles', () => {
  test('a shared row with a maker is a bottle; one without stays unsaid', async () => {
    assert.equal((await get(ids.bottle)).ingredient_role, 'product');
    const plain = await item({ name: 'Cask-Strength Bourbon', generic: ids.bourbon });
    assert.equal(plain.ingredient_role, null);
  });

  test('a kind of a bottle is made from it and a kind of its style', async () => {
    const { data, error } = await users.member.client
      .from('items')
      .insert({ name: n('Banana-Infused Buffalo Trace'), item_type: 'ingredient', generic_id: ids.bottle })
      .select('id, generic_id, made_from_id, ingredient_role')
      .single();
    assert.equal(error, null);
    assert.equal(data.generic_id, ids.bourbon);
    assert.equal(data.made_from_id, ids.bottle);
    assert.equal(data.ingredient_role, 'prep');
  });

  test("a venue's own version of a bottle stays a kind of it", async () => {
    const own = await item({ name: 'House Buffalo Trace', generic: ids.bottle, bar: ids.bar });
    assert.equal(own.generic_id, ids.bottle);
    assert.equal(own.made_from_id, null);
  });

  test('a core ingredient is never a bottle', async () => {
    await assert.rejects(item({ name: 'Rye', core: true, role: 'product' }), /items_core_is_not_a_product/);
  });

  test('a prep is made from a shared ingredient or its own venue’s', async () => {
    const elsewhere = (await service.from('bars').insert({ name: `Other ${run}`, slug: `other-${run}` }).select('id').single()).data.id;
    try {
      const theirs = await item({ name: 'Their Bourbon', generic: ids.bourbon, bar: elsewhere });
      await assert.rejects(item({ name: 'Our Infusion', madeFrom: theirs.id, bar: ids.bar }), /made from a shared ingredient/);
    } finally {
      await db.query("DELETE FROM public.items WHERE name LIKE '%' || $1 AND bar_id = $2", [run, elsewhere]);
      await service.from('bars').delete().eq('id', elsewhere);
    }
  });

  test('merging a copy of a bottle moves its preps and keeps what it knew', async () => {
    const kept = await item({ name: 'Wild Turkey 101', generic: ids.bourbon, role: 'product' });
    const copy = await item({ name: 'Wild Turkey 101 Bourbon', generic: ids.bourbon, maker: 'Wild Turkey', abv: 50.5 });
    const prep = await item({ name: 'Fat-Washed Wild Turkey', generic: ids.bourbon, madeFrom: copy.id });
    await db.query('SELECT private.merge_ingredient($1, $2)', [copy.id, kept.id]);
    assert.equal(await get(copy.id), undefined);
    const after = await get(kept.id);
    assert.equal(after.brand_maker, 'Wild Turkey');
    assert.equal(Number(after.abv), 50.5);
    assert.equal(after.ingredient_role, 'product');
    assert.equal((await get(prep.id)).made_from_id, kept.id);
  });

  test("merging a bottle into its own prep doesn't lose the prep", async () => {
    const bottle = await item({ name: 'Rittenhouse', generic: ids.bourbon, role: 'product' });
    const prep = await item({ name: 'Smoked Rittenhouse', generic: ids.bourbon, madeFrom: bottle.id, role: 'prep' });
    await db.query('SELECT private.merge_ingredient($1, $2)', [bottle.id, prep.id]);
    const after = await get(prep.id);
    assert.ok(after, 'the prep is still there');
    assert.equal(after.made_from_id, null);
  });

  test('the app view gives a row’s role and bottle', async () => {
    const prep = (await db.query('SELECT id FROM public.items WHERE made_from_id = $1 AND name = $2', [ids.bottle, n('Banana-Infused Buffalo Trace')])).rows[0];
    const { data, error } = await users.member.client.from('app_item_presentation').select('ingredient_role, made_from_id').eq('id', prep.id).single();
    assert.equal(error, null);
    assert.deepEqual(data, { ingredient_role: 'prep', made_from_id: ids.bottle });
  });
});
