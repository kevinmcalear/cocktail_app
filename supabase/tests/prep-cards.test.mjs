// Prep cards: the steps of a house-made ingredient follow the same rules as
// its yield and shelf life (item_prep). Runs through the real API against the
// local stack.
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
  throw new Error(`Refusing to run prep card tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);

// Base capabilities: house_made and prep open at Drink Creator (35).
const ROLES = { bartender: 30, creator: 35 };
const users = {};
const ids = {};

async function makeUser(label) {
  const email = `${label}-${run}@prep-cards-test.local`;
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

before(async () => {
  for (const label of [...Object.keys(ROLES), 'outsider']) users[label] = await makeUser(label);
  ids.bar = (await insert('bars', { name: `Prep bar ${run}` })).id;
  for (const [label, role] of Object.entries(ROLES)) {
    await insert('user_bars', { user_id: users[label].id, bar_id: ids.bar, role_level: role });
  }
  ids.syrup = (await insert('items', { name: `Ginger syrup ${run}`, item_type: 'ingredient', bar_id: ids.bar })).id;
  await insert('item_prep', { item_id: ids.syrup, yield_amount: 750, yield_unit: 'ml', storage: 'Fridge', actions: ['Syrup'] });
  await insert('item_steps', { item_id: ids.syrup, position: 0, body: 'Juice the ginger.', timer_seconds: null });
  await insert('item_steps', { item_id: ids.syrup, position: 1, body: 'Steep.', timer_seconds: 600 });
});

after(async () => {
  if (ids.syrup) await service.from('items').delete().eq('id', ids.syrup);
  if (ids.bar) await service.from('bars').delete().eq('id', ids.bar);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
});

describe('item_steps', () => {
  test('whoever sees house-made recipes reads the steps in order', async () => {
    const { data, error } = await users.creator.client.from('item_steps').select('position, body, timer_seconds').eq('item_id', ids.syrup).order('position');
    assert.ifError(error);
    assert.deepEqual(data.map((s) => s.body), ['Juice the ginger.', 'Steep.']);
    assert.equal(data[1].timer_seconds, 600);
  });

  test('a bartender below the house-made level sees nothing, nor does an outsider', async () => {
    for (const who of ['bartender', 'outsider']) {
      const { data, error } = await users[who].client.from('item_steps').select('body').eq('item_id', ids.syrup);
      assert.ifError(error);
      assert.equal(data.length, 0, who);
    }
  });

  test('the prep crew writes steps and the card, a bartender does not', async () => {
    const asBartender = await users.bartender.client.from('item_steps').insert({ item_id: ids.syrup, position: 2, body: 'Bottle.' });
    assert.ok(asBartender.error, 'a bartender is refused');
    const asCreator = await users.creator.client.from('item_steps').insert({ item_id: ids.syrup, position: 2, body: 'Bottle.' });
    assert.ifError(asCreator.error);
    const card = await users.creator.client.from('item_prep').upsert({ item_id: ids.syrup, storage: 'Freezer', actions: ['Syrup', 'Freeze'] }, { onConflict: 'item_id' }).select('storage, actions').single();
    assert.ifError(card.error);
    assert.deepEqual(card.data, { storage: 'Freezer', actions: ['Syrup', 'Freeze'] });
  });

  test('a step needs some text and a sane timer', async () => {
    const blank = await service.from('item_steps').insert({ item_id: ids.syrup, position: 9, body: '   ' });
    assert.ok(blank.error, 'a blank step is refused');
    const tooLong = await service.from('item_steps').insert({ item_id: ids.syrup, position: 9, body: 'Wait.', timer_seconds: 90000 });
    assert.ok(tooLong.error, 'a day-plus timer is refused');
  });
});
