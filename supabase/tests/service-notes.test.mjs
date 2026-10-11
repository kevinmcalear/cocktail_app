// Garnish, hand-off and talking points on a venue drink
// (supabase/migrations/20261014210000_drink_service_notes.sql): read from
// Employee up at the drink's own venue, written by whoever may edit the
// drink, stamped by the server, never readable by guests, outsiders or a
// signed-out visitor. Runs through the real API against the local stack.
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
  throw new Error(`Refusing to run service note tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);

// Bar defaults: talking points open at Employee (20); editing at Drink Creator (35).
const ROLES = { guest: 10, employee: 20, bartender: 30, creator: 35 };
const users = {};
const ids = {};

async function makeUser(label) {
  const email = `${label}-${run}@service-notes-test.local`;
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

const notes = (over = {}) => ({
  item_id: ids.drink,
  bar_id: ids.bar,
  garnish: 'Candied ginger on a pick, laid across the rim.',
  handoff: ['Coaster down first, logo facing the guest', 'Say "smoky on top" as it lands'],
  talking_point: 'Sam Ross made it at Milk & Honey in 2005.',
  sell_it_as: 'Smoky, spicy, bright.',
  ...over,
});

async function read(client) {
  const { data, error } = await client.from('item_service_notes').select('garnish, handoff, talking_point, sell_it_as, updated_by').eq('item_id', ids.drink);
  assert.ifError(error);
  return data;
}

before(async () => {
  for (const label of [...Object.keys(ROLES), 'outsider']) users[label] = await makeUser(label);
  ids.bar = (await insert('bars', { name: `Notes bar ${run}` })).id;
  for (const [label, role] of Object.entries(ROLES)) {
    await insert('user_bars', { user_id: users[label].id, bar_id: ids.bar, role_level: role });
  }
  ids.drink = (await insert('items', { name: `Penicillin ${run}`, item_type: 'cocktail', bar_id: ids.bar })).id;
  ids.otherBar = (await insert('bars', { name: `Other bar ${run}` })).id;
  await insert('user_bars', { user_id: users.outsider.id, bar_id: ids.otherBar, role_level: 40 });
  ids.otherDrink = (await insert('items', { name: `Other drink ${run}`, item_type: 'cocktail', bar_id: ids.otherBar })).id;
});

after(async () => {
  for (const id of [ids.drink, ids.otherDrink]) if (id) await service.from('items').delete().eq('id', id);
  for (const id of [ids.bar, ids.otherBar]) if (id) await service.from('bars').delete().eq('id', id);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
});

describe('item_service_notes', () => {
  test('a bartender, who cannot edit the drink, cannot write them', async () => {
    const { error } = await users.bartender.client.from('item_service_notes').insert(notes());
    assert.ok(error, 'refused');
  });

  test('a Drink Creator writes them, and the server stamps who', async () => {
    const { error } = await users.creator.client.from('item_service_notes').insert(notes({ updated_by: users.bartender.id }));
    assert.ifError(error);
    const [row] = await read(users.creator.client);
    assert.equal(row.updated_by, users.creator.id, 'the stamp ignores what the client sent');
    assert.deepEqual(row.handoff, notes().handoff);
  });

  test('Employee and up read them; a guest of the venue does not', async () => {
    for (const label of ['employee', 'bartender', 'creator']) assert.equal((await read(users[label].client)).length, 1, label);
    assert.equal((await read(users.guest.client)).length, 0, 'guest');
  });

  test('outsiders and signed-out visitors never see them', async () => {
    assert.equal((await read(users.outsider.client)).length, 0, 'outsider');
    const { data } = await anon.from('item_service_notes').select('item_id').eq('item_id', ids.drink);
    assert.ok(!data?.length, 'anon');
  });

  test('an employee cannot change or delete them', async () => {
    const { data } = await users.employee.client.from('item_service_notes').update({ garnish: 'Nothing' }).eq('item_id', ids.drink).select('item_id');
    assert.deepEqual(data, []);
    await users.employee.client.from('item_service_notes').delete().eq('item_id', ids.drink);
    assert.equal((await read(users.creator.client)).length, 1);
  });

  test('notes must sit at the drink\'s own bar, and another bar\'s admin cannot write them', async () => {
    const moved = await users.creator.client.from('item_service_notes').update({ bar_id: ids.otherBar }).eq('item_id', ids.drink).select('item_id');
    assert.ok(moved.error || !moved.data?.length, 'cannot move them to another bar');
    const foreign = await users.outsider.client.from('item_service_notes').insert(notes({ item_id: ids.drink, bar_id: ids.otherBar }));
    assert.ok(foreign.error, 'another bar cannot attach notes to this drink');
    const theirs = await users.outsider.client.from('item_service_notes').upsert(notes({ garnish: 'Mine' }), { onConflict: 'item_id' });
    assert.ok(theirs.error, 'nor overwrite them');
  });

  test('too many hand-off steps are refused', async () => {
    const { error } = await users.creator.client
      .from('item_service_notes')
      .update({ handoff: Array.from({ length: 9 }, (_, i) => `Step ${i + 1}`) })
      .eq('item_id', ids.drink);
    assert.ok(error, 'refused');
  });

  test('they go when the drink goes', async () => {
    const extra = await insert('items', { name: `Extra ${run}`, item_type: 'cocktail', bar_id: ids.bar });
    assert.ifError((await users.creator.client.from('item_service_notes').insert(notes({ item_id: extra.id }))).error);
    await service.from('items').delete().eq('id', extra.id);
    const { data } = await service.from('item_service_notes').select('item_id').eq('item_id', extra.id);
    assert.deepEqual(data, []);
  });
});
