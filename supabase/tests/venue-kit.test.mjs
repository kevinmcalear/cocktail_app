// Kit and Buying (20261019000000_venue_kit.sql, 20261110100000_kit_and_ice.sql):
// a venue's tools (bar_kit; its ice is kit-and-ice.test.mjs) are read by its
// team and written by anyone with Prep; a supplier
// says what it brings, when to order by and when it delivers; and the venue's
// glassware is written by Prep, not Brand.
// Runs against the local stack only: `npm run test:security`.
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
  throw new Error(`Refusing to run venue kit tests against a non-local API: ${status.API_URL}`);
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

before(async () => {
  await db.connect();
  for (const label of ['admin', 'creator', 'bartender', 'outsider']) users[label] = await makeUser(label);
  for (const key of ['bar', 'other']) {
    ids[key] = (await db.query('INSERT INTO public.bars (name) VALUES ($1) RETURNING id', [`kit ${key} ${run}`])).rows[0].id;
  }
  await db.query('INSERT INTO public.user_bars (bar_id, user_id, role_level) VALUES ($1, $2, 40), ($1, $3, 35), ($1, $4, 30), ($5, $6, 40)', [
    ids.bar, users.admin.id, users.creator.id, users.bartender.id, ids.other, users.outsider.id,
  ]);
  ids.supplier = (await db.query('INSERT INTO public.suppliers (bar_id, name) VALUES ($1, $2) RETURNING id', [ids.bar, `Ice Co ${run}`])).rows[0].id;
  ids.otherSupplier = (await db.query('INSERT INTO public.suppliers (bar_id, name) VALUES ($1, $2) RETURNING id', [ids.other, `Other Co ${run}`])).rows[0].id;
});

after(async () => {
  await db.query('DELETE FROM public.bars WHERE id = ANY($1)', [[ids.bar, ids.other]]);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
  await db.end();
});

describe('a venue\'s tools', () => {
  test('anyone with Prep adds tools, ours or its own; others can\'t', async () => {
    const { error: ownError } = await users.creator.client
      .from('bar_kit').insert({ bar_id: ids.bar, name: 'Bandsaw', location: 'prep', source: 'bought', supplier_id: ids.supplier });
    assert.ifError(ownError);
    const { error: toolError } = await users.admin.client.from('bar_kit').insert({ bar_id: ids.bar, kind: 'tool', key: 'shaker', location: 'bar', count: 6 });
    assert.ifError(toolError);
    const { error: bartenderError } = await users.bartender.client.from('bar_kit').insert({ bar_id: ids.bar, key: 'jigger' });
    assert.ok(bartenderError, 'a bartender has no Prep');
    const { error: outsiderError } = await users.outsider.client.from('bar_kit').insert({ bar_id: ids.bar, key: 'jigger' });
    assert.ok(outsiderError, 'not another venue');
    const { error: anonError } = await anon.from('bar_kit').insert({ bar_id: ids.bar, key: 'jigger' });
    assert.ok(anonError, 'not signed out');
  });

  test('the whole team reads it; other venues and signed-out visitors don\'t', async () => {
    const { data } = await users.bartender.client.from('bar_kit').select('key, name').eq('bar_id', ids.bar).order('created_at');
    assert.deepEqual(data, [{ key: null, name: 'Bandsaw' }, { key: 'shaker', name: null }]);
    const { data: outsider } = await users.outsider.client.from('bar_kit').select('id').eq('bar_id', ids.bar);
    assert.deepEqual(outsider, []);
    const { data: anonData, error } = await anon.from('bar_kit').select('id').eq('bar_id', ids.bar);
    assert.ok(error || anonData.length === 0, 'anon reads nothing');
  });

  test('only tools: our ids or a name, once each, in a known place', async () => {
    for (const row of [
      { kind: 'ice', key: 'cubes' },
      { key: 'Shaker Tins' },
      { key: 'shaker' },
      {},
      { name: '  ' },
      { key: 'jigger', location: 'cellar' },
      { key: 'jigger', count: 0 },
      { key: 'jigger', source: 'made' },
    ]) {
      const { error } = await service.from('bar_kit').insert({ bar_id: ids.bar, ...row });
      assert.ok(error, `${JSON.stringify(row)} refused`);
    }
  });

  test('a supplier only when bought, and only the venue\'s own', async () => {
    const { error: ours } = await service.from('bar_kit').insert({ bar_id: ids.bar, key: 'muddler', source: 'ours', supplier_id: ids.supplier });
    assert.ok(ours, 'not ours and bought');
    const { error: theirs } = await service.from('bar_kit').insert({ bar_id: ids.bar, key: 'muddler', source: 'bought', supplier_id: ids.otherSupplier });
    assert.ok(theirs, 'not another venue\'s supplier');
  });

  test('removing a supplier keeps the tool and forgets where it came from', async () => {
    const spare = (await db.query('INSERT INTO public.suppliers (bar_id, name) VALUES ($1, $2) RETURNING id', [ids.bar, `Spare ${run}`])).rows[0].id;
    await db.query("INSERT INTO public.bar_kit (bar_id, key, source, supplier_id) VALUES ($1, 'ice-pick', 'bought', $2)", [ids.bar, spare]);
    await db.query('DELETE FROM public.suppliers WHERE id = $1', [spare]);
    const { rows } = await db.query("SELECT source, supplier_id FROM public.bar_kit WHERE bar_id = $1 AND key = 'ice-pick'", [ids.bar]);
    assert.deepEqual(rows, [{ source: 'bought', supplier_id: null }]);
  });
});

describe('a venue\'s suppliers', () => {
  test('say what they bring, when to order by and when they deliver', async () => {
    const { error } = await users.creator.client
      .from('suppliers').update({ supplies: ['ice'], order_by: 'Tue 2 pm', delivers: 'Wed and Fri' }).eq('id', ids.supplier);
    assert.ifError(error);
    const { data } = await users.admin.client.from('suppliers').select('supplies, order_by, delivers').eq('id', ids.supplier).single();
    assert.deepEqual(data, { supplies: ['ice'], order_by: 'Tue 2 pm', delivers: 'Wed and Fri' });
  });

  test('only from the known list, and short', async () => {
    for (const change of [{ supplies: ['napkins'] }, { order_by: 'x'.repeat(61) }, { delivers: '  ' }]) {
      const { error } = await service.from('suppliers').update(change).eq('id', ids.supplier);
      assert.ok(error, `${JSON.stringify(change).slice(0, 40)} refused`);
    }
  });

  test('stay private to Prep and Costs', async () => {
    const { data } = await users.bartender.client.from('suppliers').select('id').eq('bar_id', ids.bar);
    assert.deepEqual(data, []);
  });
});
