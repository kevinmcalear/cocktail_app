// A house prep's recipe, yield and keep carry sources
// (20261018000000_prep_recipe_sources.sql): the three new facts are accepted,
// anything else still isn't, and the readers and writers stay as they were
// (signed-in people read a shared prep's sources, nobody reads a venue prep's,
// only app admins write them).
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
  throw new Error(`Refusing to run prep recipe source tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });
const ids = {};
const users = {};

async function signIn(name) {
  const email = `${name}-${run}@security-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  await client.auth.signInWithPassword({ email, password: PASSWORD });
  return { id: data.user.id, client };
}

const addSource = (item, field, url) =>
  db.query(`INSERT INTO public.item_sources (item_id, field, url, kind, checked_on) VALUES ($1, $2, $3, 'reference', DATE '2026-10-14')`, [item, field, url]);

before(async () => {
  await db.connect();
  users.reader = await signIn('reader');
  users.admin = await signIn('admin');
  await db.query('INSERT INTO private.app_admins (user_id) VALUES ($1)', [users.admin.id]);
  await db.query("SET app.image_worker = 'on'");
  const bar = await db.query('INSERT INTO public.bars (name) VALUES ($1) RETURNING id', [`Sources Bar ${run}`]);
  ids.bar = bar.rows[0].id;
  const add = (name, barId) =>
    db.query(`INSERT INTO public.items (name, item_type, ingredient_role, bar_id) VALUES ($1, 'ingredient', 'prep', $2) RETURNING id`, [name, barId]);
  ids.shared = (await add(`Sources cordial ${run}`, null)).rows[0].id;
  ids.venue = (await add(`House sources cordial ${run}`, ids.bar)).rows[0].id;
  for (const field of ['recipe', 'yield', 'keeps']) await addSource(ids.shared, field, `https://example.com/${field}-${run}`);
  await addSource(ids.venue, 'recipe', `https://example.com/house-${run}`);
});

after(async () => {
  await db.query('DELETE FROM public.items WHERE id = ANY($1::uuid[])', [[ids.shared, ids.venue]]);
  await db.query('DELETE FROM public.bars WHERE id = $1', [ids.bar]);
  await db.query('DELETE FROM private.app_admins WHERE user_id = $1', [users.admin?.id]);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
  await db.end();
});

describe('prep recipe sources', () => {
  test('recipe, yield and keeps are facts a source can back; anything else still is not', async () => {
    const { rows } = await db.query('SELECT field FROM public.item_sources WHERE item_id = $1 ORDER BY field', [ids.shared]);
    assert.deepEqual(rows.map((r) => r.field), ['keeps', 'recipe', 'yield']);
    await assert.rejects(addSource(ids.shared, 'price', `https://example.com/price-${run}`), /item_sources_field_check/);
  });

  test("a signed-in reader reads a shared prep's sources, nobody reads a venue prep's", async () => {
    const shared = await users.reader.client.from('item_sources').select('field').eq('item_id', ids.shared);
    assert.equal(shared.error, null);
    assert.equal(shared.data.length, 3);
    const venue = await users.reader.client.from('item_sources').select('field').eq('item_id', ids.venue);
    assert.equal(venue.data?.length ?? 0, 0);
    const signedOut = await anon.from('item_sources').select('field').eq('item_id', ids.shared);
    assert.equal(signedOut.data?.length ?? 0, 0, 'signed out, like the row itself');
  });

  test('only app admins write them', async () => {
    const row = { item_id: ids.shared, field: 'keeps', url: `https://example.com/keeps-2-${run}`, kind: 'law', checked_on: '2026-10-14' };
    assert.ok((await users.reader.client.from('item_sources').insert(row)).error, 'a signed-in reader cannot add one');
    assert.ok((await anon.from('item_sources').insert(row)).error, 'nor can anyone signed out');
    const admin = await users.admin.client.from('item_sources').insert(row).select('id');
    assert.equal(admin.error, null);
    assert.equal(admin.data.length, 1);
  });
});
