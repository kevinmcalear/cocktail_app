// Specs filled in from a classic, and classic aliases
// (supabase/migrations/20261011140000_classic_fill.sql): only an app admin
// marks a spec as the classic's, the first edit by someone signed in makes it
// the drink's own, a filled spec never counts as the bar choosing the classic,
// and an alias counts as the classic's name. Local stack only:
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
  throw new Error(`Refusing to run classic fill tests against a non-local API: ${status.API_URL}`);
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
  const email = `${label}-${run}@classic-fill-test.local`;
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

async function recipe(key, lines) {
  for (const [i, [ing, ml]] of lines.entries()) {
    await serviceInsert('recipes', { recipe_item_id: ids[key], ingredient_item_id: ids[ing], amount: ml, unit: 'ml', sort_order: i });
  }
}

const verdict = async (key) =>
  (await db.query('SELECT verdict FROM private.item_spec_matches WHERE item_id = $1', [ids[key]])).rows[0]?.verdict;

before(async () => {
  await db.connect();
  for (const label of ['admin', 'maker']) users[label] = await makeUser(label);
  await db.query('INSERT INTO private.app_admins (user_id) VALUES ($1)', [users.admin.id]);
  for (const key of ['gin', 'vermouth', 'campari']) await item(key, { name: name(`Fill ${key}`), item_type: 'ingredient', ingredient_role: 'generic' });
  await item('classic', { name: name('Fill Negroni'), item_type: 'cocktail', is_catalog: true });
  await recipe('classic', [['gin', 30], ['campari', 30], ['vermouth', 30]]);
  ids.bar = (await serviceInsert('profiles', { kind: 'bar', handle: `fill${run}`, display_name: name('Fill Bar'), is_public: true })).id;

  // A credited drink whose spec was filled in from the classic.
  await item('filled', { name: name('Fill Negroni'), item_type: 'cocktail', origin_bar_profile_id: ids.bar, riff_of_id: ids.classic });
  await recipe('filled', [['gin', 30], ['campari', 30], ['vermouth', 30]]);
  await db.query("UPDATE public.items SET spec_source = 'classic', spec_from_id = $2 WHERE id = $1", [ids.filled, ids.classic]);
  await db.query('SELECT private.spec_match_refresh(ARRAY[$1]::uuid[])', [ids.filled]);

  // A drink the maker owns, also filled in from the classic.
  await item('mine', { name: name('Fill Negroni'), item_type: 'cocktail', created_by: users.maker.id, riff_of_id: ids.classic });
  await db.query("UPDATE public.items SET spec_source = 'classic', spec_from_id = $2 WHERE id = $1", [ids.mine, ids.classic]);

  // An alias of the classic, and a bar's drink by that name with the classic's spec.
  await db.query('INSERT INTO public.classic_aliases (classic_id, alias, source) VALUES ($1, $2, $3)', [ids.classic, name('Fill Camillo'), 'https://example.org/negroni']);
  await item('aliased', { name: name('Fill Camillo'), item_type: 'cocktail', origin_bar_profile_id: ids.bar, riff_of_id: ids.classic });
  await recipe('aliased', [['gin', 30], ['campari', 30], ['vermouth', 30]]);
});

after(async () => {
  await db.query('DELETE FROM public.classic_aliases WHERE classic_id = $1', [ids.classic]);
  await db.query('DELETE FROM public.recipes WHERE recipe_item_id = ANY($1)', [created]);
  await db.query('DELETE FROM public.items WHERE id = ANY($1)', [created.slice().reverse()]);
  await db.query('DELETE FROM public.profiles WHERE id = $1', [ids.bar]);
  await db.query('DELETE FROM private.app_admins WHERE user_id = $1', [users.admin.id]);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
  await db.end();
});

describe('a spec filled in from the classic', () => {
  test('never counts as the bar choosing the classic', async () => {
    assert.equal(await verdict('filled'), 'unlisted');
  });

  test("the first edit by someone signed in makes it the drink's own", async () => {
    const { error } = await users.maker.client.from('recipes').insert({ recipe_item_id: ids.mine, ingredient_item_id: ids.gin, amount: 45, unit: 'ml', sort_order: 0 });
    assert.ifError(error);
    const { rows } = await db.query('SELECT spec_source, spec_from_id FROM public.items WHERE id = $1', [ids.mine]);
    assert.deepEqual(rows[0], { spec_source: 'bar', spec_from_id: null });
  });

  test("only an app admin can mark a spec as the classic's", async () => {
    const maker = await users.maker.client.from('items').update({ spec_source: 'classic', spec_from_id: ids.classic }).eq('id', ids.mine).select('id');
    assert.ok(maker.error, 'the maker is refused');
    const admin = await users.admin.client.from('items').update({ spec_source: 'classic', spec_from_id: ids.classic }).eq('id', ids.mine).select('id');
    assert.ifError(admin.error);
  });
});

describe('classic aliases', () => {
  test("an alias counts as the classic's name, so the same spec folds", async () => {
    assert.equal(await verdict('aliased'), 'same');
  });

  test('everyone can read them; nobody signed in can write them', async () => {
    const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
    const read = await anon.from('classic_aliases').select('alias').eq('classic_id', ids.classic);
    assert.ifError(read.error);
    assert.equal(read.data.length, 1);
    const write = await users.admin.client.from('classic_aliases').insert({ classic_id: ids.classic, alias: name('Another'), source: 'https://example.org/x' });
    assert.ok(write.error);
  });
});
