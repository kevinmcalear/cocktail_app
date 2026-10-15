// Notes only their writer reads (supabase/migrations/20261025100000_item_private_notes.sql):
// written on a drink the writer can read, read, changed and removed by the
// writer alone, never by the drink's venue, another person, or a signed-out
// visitor, and gone with the drink. Runs through the real API against the
// local stack.
//
//   supabase start && supabase db reset
//   npm run test:security

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run private note tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const users = {};
const ids = {};

async function makeUser(label) {
  const email = `${label}-${run}@private-notes-test.local`;
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

const notesOn = async (client, itemId) => {
  const { data, error } = await client.from('item_private_notes').select('user_id, body').eq('item_id', itemId);
  assert.ifError(error);
  return data;
};

before(async () => {
  for (const label of ['writer', 'teammate', 'stranger']) users[label] = await makeUser(label);
  ids.bar = (await insert('bars', { name: `Private notes bar ${run}` })).id;
  for (const label of ['writer', 'teammate']) await insert('user_bars', { user_id: users[label].id, bar_id: ids.bar, role_level: 40 });
  ids.venueDrink = (await insert('items', { name: `Venue drink ${run}`, item_type: 'cocktail', bar_id: ids.bar })).id;
  ids.homeDrink = (await insert('items', { name: `Home drink ${run}`, item_type: 'cocktail', created_by: users.writer.id })).id;
  ids.strangersDrink = (await insert('items', { name: `Stranger's drink ${run}`, item_type: 'cocktail', created_by: users.stranger.id })).id;
});

after(async () => {
  for (const id of Object.values(ids)) await service.from('items').delete().eq('id', id);
  await service.from('bars').delete().eq('id', ids.bar);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
});

test('the writer adds a note on a drink at their venue and on their own; only they read it', async () => {
  for (const itemId of [ids.venueDrink, ids.homeDrink]) {
    const { error } = await users.writer.client.from('item_private_notes').insert({ item_id: itemId, body: 'Less sugar next time.' });
    assert.ifError(error);
    assert.deepEqual(await notesOn(users.writer.client, itemId), [{ user_id: users.writer.id, body: 'Less sugar next time.' }]);
  }
  assert.deepEqual(await notesOn(users.teammate.client, ids.venueDrink), [], 'the venue team does not read it');
  assert.deepEqual(await notesOn(users.stranger.client, ids.homeDrink), [], 'nor does anyone else');
  const { data, error } = await anon.from('item_private_notes').select('body');
  assert.ok(error || data.length === 0, 'nor a signed-out visitor');
});

test('a note goes only on a drink you can read, and only as yourself', async () => {
  let { error } = await users.writer.client.from('item_private_notes').insert({ item_id: ids.strangersDrink, body: 'Peek.' });
  assert.ok(error, 'not on a private drink of someone else');
  ({ error } = await users.teammate.client.from('item_private_notes').insert({ user_id: users.writer.id, item_id: ids.venueDrink, body: 'Forged.' }));
  assert.ok(error, 'not in someone else’s name');
  ({ error } = await users.writer.client.from('item_private_notes').insert({ item_id: ids.homeDrink, body: '   ' }));
  assert.ok(error, 'not empty');
  ({ error } = await users.writer.client.from('item_private_notes').insert({ item_id: ids.homeDrink, body: 'Twice.' }));
  assert.ok(error, 'one note per drink');
});

test('only the writer changes or removes it, and it can’t move to another drink', async () => {
  const { data: stolen } = await users.teammate.client.from('item_private_notes').update({ body: 'Changed.' }).eq('item_id', ids.venueDrink).select();
  assert.deepEqual(stolen ?? [], []);
  const { data: gone } = await users.teammate.client.from('item_private_notes').delete().eq('item_id', ids.venueDrink).select();
  assert.deepEqual(gone ?? [], []);

  let { error } = await users.writer.client.from('item_private_notes').update({ item_id: ids.venueDrink }).eq('item_id', ids.homeDrink);
  assert.ok(error, 'the drink is fixed');
  ({ error } = await users.writer.client.from('item_private_notes').update({ body: 'Half the sugar.', updated_at: new Date().toISOString() }).eq('item_id', ids.homeDrink));
  assert.ifError(error);
  assert.equal((await notesOn(users.writer.client, ids.homeDrink))[0].body, 'Half the sugar.');
  ({ error } = await users.writer.client.from('item_private_notes').delete().eq('item_id', ids.homeDrink));
  assert.ifError(error);
  assert.deepEqual(await notesOn(users.writer.client, ids.homeDrink), []);
});

test('a note goes with its drink', async () => {
  await service.from('items').delete().eq('id', ids.venueDrink);
  const { data } = await service.from('item_private_notes').select('item_id').eq('item_id', ids.venueDrink);
  assert.deepEqual(data, []);
});
