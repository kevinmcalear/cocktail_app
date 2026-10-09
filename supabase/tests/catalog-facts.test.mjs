// Where catalog facts come from (20261011151000_catalog_facts.sql): signed-in
// people read the sources of a shared row, nobody reads a venue row's, only
// app admins write them, a merge carries them over, and a bottle's country is an
// ISO code.
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
  throw new Error(`Refusing to run catalog facts tests against a non-local API: ${status.API_URL}`);
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

before(async () => {
  await db.connect();
  users.reader = await signIn('reader');
  users.admin = await signIn('admin');
  await db.query('INSERT INTO private.app_admins (user_id) VALUES ($1)', [users.admin.id]);
  await db.query("SET app.image_worker = 'on'");
  const bar = await db.query('INSERT INTO public.bars (name) VALUES ($1) RETURNING id', [`Facts Bar ${run}`]);
  ids.bar = bar.rows[0].id;
  const add = (name, barId) =>
    db.query(`INSERT INTO public.items (name, item_type, ingredient_role, bar_id) VALUES ($1, 'ingredient', 'product', $2) RETURNING id`, [name, barId]);
  ids.shared = (await add(`Facts Gin ${run}`, null)).rows[0].id;
  ids.copy = (await add(`Facts Gin Copy ${run}`, null)).rows[0].id;
  ids.venue = (await add(`House Facts Gin ${run}`, ids.bar)).rows[0].id;
  for (const [item, url] of [
    [ids.shared, `https://example.com/gin-${run}`],
    [ids.copy, `https://example.com/copy-${run}`],
    [ids.venue, `https://example.com/house-${run}`],
  ]) {
    await db.query(`INSERT INTO public.item_sources (item_id, field, url, kind, checked_on) VALUES ($1, 'exists', $2, 'producer', DATE '2026-10-09')`, [item, url]);
  }
});

after(async () => {
  await db.query('DELETE FROM public.items WHERE id = ANY($1::uuid[])', [[ids.shared, ids.copy, ids.venue]]);
  await db.query('DELETE FROM public.bars WHERE id = $1', [ids.bar]);
  await db.query('DELETE FROM private.app_admins WHERE user_id = $1', [users.admin?.id]);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
  await db.end();
});

describe('catalog facts', () => {
  test("a signed-in reader reads a shared row's sources, nobody reads a venue row's", async () => {
    const shared = await users.reader.client.from('item_sources').select('url').eq('item_id', ids.shared);
    assert.equal(shared.error, null);
    assert.equal(shared.data.length, 1);
    const venue = await users.reader.client.from('item_sources').select('url').eq('item_id', ids.venue);
    assert.equal(venue.data?.length ?? 0, 0);
    const signedOut = await anon.from('item_sources').select('url').eq('item_id', ids.shared);
    assert.equal(signedOut.data?.length ?? 0, 0, 'signed out, like the row itself');
  });

  test('only app admins write sources', async () => {
    const row = { item_id: ids.shared, field: 'abv', url: `https://example.com/abv-${run}`, kind: 'retailer', checked_on: '2026-10-09' };
    const reader = await users.reader.client.from('item_sources').insert(row);
    assert.ok(reader.error, 'a signed-in reader cannot add a source');
    const drop = await users.reader.client.from('item_sources').delete().eq('item_id', ids.shared).select('id');
    assert.equal(drop.data?.length ?? 0, 0, 'nor remove one');
    const viaAnon = await anon.from('item_sources').insert(row);
    assert.ok(viaAnon.error, 'nor can anyone signed out');
    const admin = await users.admin.client.from('item_sources').insert(row).select('id');
    assert.equal(admin.error, null);
    assert.equal(admin.data.length, 1);
  });

  test('a source is a web page of a known kind', async () => {
    await assert.rejects(
      db.query(`INSERT INTO public.item_sources (item_id, field, url, kind, checked_on) VALUES ($1, 'exists', 'not a url', 'producer', DATE '2026-10-09')`, [ids.shared]),
      /item_sources_url_check/
    );
    await assert.rejects(
      db.query(`INSERT INTO public.item_sources (item_id, field, url, kind, checked_on) VALUES ($1, 'exists', 'https://example.com/x', 'blog', DATE '2026-10-09')`, [ids.shared]),
      /item_sources_kind_check/
    );
  });

  test('a merge keeps the copy\'s sources on the bottle', async () => {
    await db.query('SELECT private.merge_ingredient($1, $2)', [ids.copy, ids.shared]);
    const { rows } = await db.query('SELECT url FROM public.item_sources WHERE item_id = $1 ORDER BY url', [ids.shared]);
    assert.ok(rows.some((r) => r.url === `https://example.com/copy-${run}`));
  });

  test('a country is a two-letter code; signed-in people read it with the bottle', async () => {
    await assert.rejects(db.query(`UPDATE public.items SET origin_country = 'Scotland' WHERE id = $1`, [ids.shared]), /items_origin_country_code/);
    await db.query(`UPDATE public.items SET origin_country = 'GB', gi = 'Plymouth Gin' WHERE id = $1`, [ids.shared]);
    const { data, error } = await users.reader.client.from('items').select('origin_country, gi').eq('id', ids.shared).single();
    assert.equal(error, null);
    assert.deepEqual(data, { origin_country: 'GB', gi: 'Plymouth Gin' });
  });
});
