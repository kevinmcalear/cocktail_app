// Step asides and notes (supabase/migrations/20261205800000_step_notes.sql).
// Whoever the server gives a drink's amounts to reads its step words; a role
// that doesn't get them, another bar's people and signed-out visitors don't.
// Only those who can edit the drink write them. Runs through the real API
// against the local stack.
//
//   supabase start && supabase db reset
//   npm run test:security

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run step notes tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const users = {};
const ids = {};

const LEVELS = { admin: 40, bartender: 30, floor: 20, guest: 10 };

async function makeUser(label) {
  const email = `${label}-${run}@step-notes-test.local`;
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

const notesAs = (client) => client.from('drink_step_notes').select('step_key, aside, note').eq('item_id', ids.drink);

before(async () => {
  for (const label of [...Object.keys(LEVELS), 'stranger']) users[label] = await makeUser(label);
  ids.bar = (await insert('bars', { name: `Step bar ${run}`, default_measurement_level: 30 })).id;
  for (const [label, level] of Object.entries(LEVELS)) await insert('user_bars', { user_id: users[label].id, bar_id: ids.bar, role_level: level });
  ids.other = (await insert('bars', { name: `Other step bar ${run}` })).id;
  await insert('user_bars', { user_id: users.stranger.id, bar_id: ids.other, role_level: 40 });
  ids.drink = (await insert('items', { name: `Step drink ${run}`, item_type: 'cocktail', bar_id: ids.bar })).id;
  ids.gin = (await insert('items', { name: `Step gin ${run}`, item_type: 'ingredient', bar_id: ids.bar })).id;
  await insert('recipes', { recipe_item_id: ids.drink, ingredient_item_id: ids.gin, amount: 60, unit: 'ml' });
  await insert('drink_step_notes', { item_id: ids.drink, step_key: 'main', aside: 'hard, with ice', note: 'Strain over one large cube.' });
});

after(async () => {
  for (const id of [ids.drink, ids.gin]) if (id) await service.from('items').delete().eq('id', id);
  for (const id of [ids.bar, ids.other]) if (id) await service.from('bars').delete().eq('id', id);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
});

describe('the table', () => {
  test('a step has one row, named as the page names it', async () => {
    const dup = await service.from('drink_step_notes').insert({ item_id: ids.drink, step_key: 'main', note: 'Again' });
    assert.match(dup.error?.message ?? '', /duplicate/);
    for (const step_key of ['part-1', 'shake', 'part-', '']) {
      const bad = await service.from('drink_step_notes').insert({ item_id: ids.drink, step_key, note: 'No' });
      assert.match(bad.error?.message ?? '', /step_key_check/, step_key);
    }
  });

  test('a row has words, and they fit', async () => {
    const empty = await service.from('drink_step_notes').insert({ item_id: ids.drink, step_key: 'float' });
    assert.match(empty.error?.message ?? '', /has_words/);
    const blank = await service.from('drink_step_notes').insert({ item_id: ids.drink, step_key: 'float', note: '   ' });
    assert.ok(blank.error, 'blank note refused');
    const long = await service.from('drink_step_notes').insert({ item_id: ids.drink, step_key: 'float', aside: 'x'.repeat(61) });
    assert.ok(long.error, 'long aside refused');
  });

  test('deleting the drink takes its words', async () => {
    const drink = await insert('items', { name: `Gone drink ${run}`, item_type: 'cocktail', bar_id: ids.bar });
    await insert('drink_step_notes', { item_id: drink.id, step_key: 'garnish', note: 'On a pick' });
    await service.from('items').delete().eq('id', drink.id);
    const { data } = await service.from('drink_step_notes').select('step_key').eq('item_id', drink.id);
    assert.deepEqual(data, []);
  });
});

describe('who reads it', () => {
  test('the Admin and the Bartender, who get the amounts', async () => {
    for (const label of ['admin', 'bartender']) {
      const { data, error } = await notesAs(users[label].client);
      assert.ifError(error);
      assert.deepEqual(data, [{ step_key: 'main', aside: 'hard, with ice', note: 'Strain over one large cube.' }], label);
    }
  });

  test('roles the bar keeps the amounts from, another bar and a signed-out visitor read nothing', async () => {
    for (const [who, client] of [['floor', users.floor.client], ['guest', users.guest.client], ['stranger', users.stranger.client], ['anon', anon]]) {
      const { data, error } = await notesAs(client);
      if (who === 'anon') assert.ok(error || !data?.length, who);
      else {
        assert.ifError(error);
        assert.deepEqual(data, [], who);
      }
    }
  });

  test('the drink page embeds them through the same rule', async () => {
    const read = (client) => client.from('app_item_presentation').select('id, step_notes:drink_step_notes(step_key, aside, note)').eq('id', ids.drink).single();
    const bartender = await read(users.bartender.client);
    assert.ifError(bartender.error);
    assert.equal(bartender.data.step_notes.length, 1);
    const floor = await read(users.floor.client);
    if (!floor.error) assert.deepEqual(floor.data.step_notes, []);
  });
});

describe('who writes it', () => {
  test('the Admin adds, changes and removes', async () => {
    const { client } = users.admin;
    assert.ifError((await client.from('drink_step_notes').upsert({ item_id: ids.drink, step_key: 'float', note: 'Over a spoon' })).error);
    assert.ifError((await client.from('drink_step_notes').upsert({ item_id: ids.drink, step_key: 'float', aside: 'gently', note: null })).error);
    const { data } = await service.from('drink_step_notes').select('aside, note').eq('item_id', ids.drink).eq('step_key', 'float').single();
    assert.deepEqual(data, { aside: 'gently', note: null });
    assert.ifError((await client.from('drink_step_notes').delete().eq('item_id', ids.drink).eq('step_key', 'float')).error);
  });

  test('nobody who cannot edit the drink, either way', async () => {
    for (const label of ['bartender', 'floor', 'guest', 'stranger']) {
      const add = await users[label].client.from('drink_step_notes').insert({ item_id: ids.drink, step_key: 'garnish', note: 'Nope' });
      assert.ok(add.error, `${label} cannot add`);
      await users[label].client.from('drink_step_notes').update({ note: 'Changed' }).eq('item_id', ids.drink).eq('step_key', 'main');
      await users[label].client.from('drink_step_notes').delete().eq('item_id', ids.drink).eq('step_key', 'main');
    }
    const signedOut = await anon.from('drink_step_notes').insert({ item_id: ids.drink, step_key: 'garnish', note: 'Nope' });
    assert.ok(signedOut.error, 'signed out cannot add');
    const { data } = await service.from('drink_step_notes').select('step_key, note').eq('item_id', ids.drink);
    assert.deepEqual(data, [{ step_key: 'main', note: 'Strain over one large cube.' }]);
  });
});

