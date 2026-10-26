// Keep the drawing (20261122200000_show_sketch.sql): whether a drink's page
// still shows its drawing once it has a photo (E26). Only the drink's editors
// change it, like any other field on the drink. Runs against the local stack.
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
  throw new Error(`Refusing to run show-sketch tests against a non-local API: ${status.API_URL}`);
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
  const email = `${label}-${run}@show-sketch-test.local`;
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

const shown = async (itemId) => (await db.query('SELECT show_sketch FROM public.items WHERE id = $1', [itemId])).rows[0].show_sketch;
const setShown = (who, itemId, value) => users[who].client.from('items').update({ show_sketch: value }).eq('id', itemId).select('id');

before(async () => {
  await db.connect();
  for (const label of ['creator', 'bartender', 'outsider', 'home']) users[label] = await makeUser(label);
  ids.bar = (await serviceInsert('bars', { name: `Show Sketch Bar ${run}` })).id;
  await serviceInsert('user_bars', { user_id: users.creator.id, bar_id: ids.bar, role_level: 35 });
  await serviceInsert('user_bars', { user_id: users.bartender.id, bar_id: ids.bar, role_level: 30 });
  ids.venue = (await serviceInsert('items', { name: `House Ash Garden ${run}`, item_type: 'cocktail', bar_id: ids.bar })).id;
  ids.home = (await serviceInsert('items', { name: `Home Ash Garden ${run}`, item_type: 'cocktail', created_by: users.home.id })).id;
});

after(async () => {
  const like = `%${run}%`;
  const { rows } = await db.query('SELECT id FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM private.item_flavor_jobs WHERE item_id = ANY($1)', [rows.map((r) => r.id)]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('keep the drawing after the photos', () => {
  test('every drink keeps its drawing until someone says otherwise', async () => {
    assert.equal(await shown(ids.venue), true);
    assert.equal(await shown(ids.home), true);
  });

  test('the bar\'s creators and the home drink\'s maker can remove it, and keep it again', async () => {
    const venue = await setShown('creator', ids.venue, false);
    assert.ifError(venue.error);
    assert.equal(venue.data.length, 1);
    assert.equal(await shown(ids.venue), false);
    assert.ifError((await setShown('home', ids.home, false)).error);
    assert.equal(await shown(ids.home), false);
    assert.ifError((await setShown('home', ids.home, true)).error);
    assert.equal(await shown(ids.home), true);
  });

  test('a bartender, someone else, and signed out change nothing', async () => {
    for (const who of ['bartender', 'outsider']) {
      const { data } = await setShown(who, ids.venue, true);
      assert.equal(data?.length ?? 0, 0, `${who} refused`);
    }
    const { data } = await setShown('outsider', ids.home, false);
    assert.equal(data?.length ?? 0, 0, 'not someone else\'s home drink');
    await anon.from('items').update({ show_sketch: true }).eq('id', ids.venue);
    assert.equal(await shown(ids.venue), false);
    assert.equal(await shown(ids.home), true);
  });

  test('it is never null', async () => {
    const { error } = await setShown('creator', ids.venue, null);
    assert.ok(error);
    assert.equal(await shown(ids.venue), false);
  });
});
