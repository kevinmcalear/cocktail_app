// Glass capacity, iced capacity and ice per serve: read with the item, set by
// whoever can edit it, within sane bounds. Runs through the real API against
// the local stack.
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
  throw new Error(`Refusing to run glass tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);

const ROLES = { employee: 20, bartender: 30, creator: 35 };
const users = {};
const ids = {};

async function makeUser(label) {
  const email = `${label}-${run}@glass-ice-test.local`;
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
  for (const label of Object.keys(ROLES)) users[label] = await makeUser(label);
  ids.bar = (await insert('bars', { name: `Glass bar ${run}` })).id;
  for (const [label, role] of Object.entries(ROLES)) {
    await insert('user_bars', { user_id: users[label].id, bar_id: ids.bar, role_level: role });
  }
  ids.catalogueGlass = (await insert('items', { name: `Coupe ${run}`, item_type: 'glassware', capacity_ml: 180, iced_capacity_ml: 180 })).id;
  ids.venueGlass = (await insert('items', { name: `House rocks ${run}`, item_type: 'glassware', bar_id: ids.bar })).id;
  ids.drink = (await insert('items', { name: `Old Fashioned ${run}`, item_type: 'cocktail', bar_id: ids.bar, glassware_id: ids.venueGlass })).id;
});

after(async () => {
  for (const id of [ids.drink, ids.venueGlass, ids.catalogueGlass]) if (id) await service.from('items').delete().eq('id', id);
  if (ids.bar) await service.from('bars').delete().eq('id', ids.bar);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
});

describe('glass capacity', () => {
  test('reads with the glass for everyone who can see it', async () => {
    const { data, error } = await users.employee.client.from('app_item_presentation').select('capacity_ml, iced_capacity_ml').eq('id', ids.catalogueGlass).single();
    assert.ifError(error);
    assert.deepEqual(data, { capacity_ml: 180, iced_capacity_ml: 180 });
  });

  test("the venue's glass is set by its drink editors, the catalogue's is not", async () => {
    const asBartender = await users.bartender.client.from('items').update({ capacity_ml: 350, iced_capacity_ml: 200 }).eq('id', ids.venueGlass).select('id');
    assert.ok(asBartender.error || asBartender.data.length === 0, 'a bartender changes nothing');
    const asCreator = await users.creator.client.from('items').update({ capacity_ml: 350, iced_capacity_ml: 200 }).eq('id', ids.venueGlass).select('capacity_ml, iced_capacity_ml').single();
    assert.ifError(asCreator.error);
    assert.deepEqual(asCreator.data, { capacity_ml: 350, iced_capacity_ml: 200 });
    const catalogue = await users.creator.client.from('items').update({ capacity_ml: 999 }).eq('id', ids.catalogueGlass).select('id');
    assert.ok(catalogue.error || catalogue.data.length === 0, 'the shared catalogue is not theirs to change');
  });

  test('the iced capacity is at most the capacity', async () => {
    const bad = await service.from('items').update({ capacity_ml: 200, iced_capacity_ml: 250 }).eq('id', ids.venueGlass);
    assert.ok(bad.error, 'refused');
    const zero = await service.from('items').update({ capacity_ml: 0 }).eq('id', ids.venueGlass);
    assert.ok(zero.error, 'a 0 ml glass is refused');
  });
});

describe('ice per serve', () => {
  test("the drink's editors set it; it reads with the drink", async () => {
    const asBartender = await users.bartender.client.from('items').update({ ice_per_serve_g: 140 }).eq('id', ids.drink).select('id');
    assert.ok(asBartender.error || asBartender.data.length === 0);
    const asCreator = await users.creator.client.from('items').update({ ice_per_serve_g: 140 }).eq('id', ids.drink);
    assert.ifError(asCreator.error);
    const { data, error } = await users.employee.client.from('app_item_presentation').select('ice_per_serve_g').eq('id', ids.drink).single();
    assert.ifError(error);
    assert.equal(data.ice_per_serve_g, 140);
    const negative = await service.from('items').update({ ice_per_serve_g: -5 }).eq('id', ids.drink);
    assert.ok(negative.error, 'negative ice is refused');
  });
});
