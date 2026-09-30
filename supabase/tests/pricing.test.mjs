// Pricing settings and menu prices: the bar's settings are its admins' to
// change and its members' to read; the numeric menu price reads with the
// drink; pack prices still need the costs capability and a currency. Runs
// through the real API against the local stack.
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
  throw new Error(`Refusing to run pricing tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);

// costs opens at Admin (40) by default; prep at Drink Creator (35).
const ROLES = { employee: 20, creator: 35, admin: 40 };
const users = {};
const ids = {};

async function makeUser(label) {
  const email = `${label}-${run}@pricing-test.local`;
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
  ids.bar = (await insert('bars', { name: `Pricing bar ${run}` })).id;
  for (const [label, role] of Object.entries(ROLES)) {
    await insert('user_bars', { user_id: users[label].id, bar_id: ids.bar, role_level: role });
  }
  ids.rum = (await insert('items', { name: `White rum ${run}`, item_type: 'ingredient' })).id;
  ids.drink = (await insert('items', { name: `Daiquiri ${run}`, item_type: 'cocktail', bar_id: ids.bar, price: '12.50' })).id;
});

after(async () => {
  for (const id of [ids.drink, ids.rum]) if (id) await service.from('items').delete().eq('id', id);
  if (ids.bar) await service.from('bars').delete().eq('id', ids.bar);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
});

describe('pricing settings', () => {
  test('start at no tax, prices include tax, no target; only an admin changes them', async () => {
    const { data, error } = await users.employee.client.from('bars').select('currency, tax_rate, prices_include_tax, target_gp').eq('id', ids.bar).single();
    assert.ifError(error);
    assert.deepEqual(data, { currency: null, tax_rate: 0, prices_include_tax: true, target_gp: null });
    const asCreator = await users.creator.client.from('bars').update({ tax_rate: 20 }).eq('id', ids.bar).select('id');
    assert.ok(asCreator.error || asCreator.data.length === 0, 'a Drink Creator changes nothing');
    const asAdmin = await users.admin.client.from('bars').update({ currency: 'GBP', tax_rate: 20, prices_include_tax: true, target_gp: 80 }).eq('id', ids.bar).select('currency, tax_rate, target_gp').single();
    assert.ifError(asAdmin.error);
    assert.deepEqual(asAdmin.data, { currency: 'GBP', tax_rate: 20, target_gp: 80 });
  });

  test('keeps the figures sane', async () => {
    assert.ok((await service.from('bars').update({ tax_rate: 120 }).eq('id', ids.bar)).error, 'tax over 100% is refused');
    assert.ok((await service.from('bars').update({ target_gp: 100 }).eq('id', ids.bar)).error, 'a 100% GP is refused');
    assert.ok((await service.from('bars').update({ currency: 'pounds' }).eq('id', ids.bar)).error, 'a currency is three capital letters');
  });
});

describe('menu price', () => {
  test('a plain typed price carried over to minor units, and reads with the drink', async () => {
    const { data, error } = await users.employee.client.from('app_item_presentation').select('price, price_minor').eq('id', ids.drink).single();
    assert.ifError(error);
    // The backfill in the migration ran before this fixture existed; a fresh row starts empty.
    assert.equal(data.price, '12.50');
    const set = await users.creator.client.from('items').update({ price_minor: 1250 }).eq('id', ids.drink).select('price_minor').single();
    assert.ifError(set.error);
    assert.equal(set.data.price_minor, 1250);
    assert.ok((await service.from('items').update({ price_minor: -1 }).eq('id', ids.drink)).error, 'a negative price is refused');
  });
});

describe('pack prices', () => {
  test('the creator sets the pack, only the admin the price, and only once the bar has a currency', async () => {
    const pack = await users.creator.client.from('item_purchasing').upsert({ bar_id: ids.bar, item_id: ids.rum, pack_size_amount: 700, pack_size_unit: 'ml' }, { onConflict: 'bar_id,item_id' });
    assert.ifError(pack.error);
    const asCreator = await users.creator.client.from('item_costs').upsert({ bar_id: ids.bar, item_id: ids.rum, pack_cost_minor: 2200 }, { onConflict: 'bar_id,item_id' });
    assert.ok(asCreator.error, 'costs need the costs capability');
    const asAdmin = await users.admin.client.from('item_costs').upsert({ bar_id: ids.bar, item_id: ids.rum, pack_cost_minor: 2200 }, { onConflict: 'bar_id,item_id' }).select('pack_cost_minor').single();
    assert.ifError(asAdmin.error);
    assert.equal(asAdmin.data.pack_cost_minor, 2200);
    const read = await users.creator.client.from('item_costs').select('pack_cost_minor').eq('bar_id', ids.bar);
    assert.ifError(read.error);
    assert.equal(read.data.length, 0, 'a Drink Creator never sees the price');
    await service.from('item_costs').delete().eq('bar_id', ids.bar);
    await service.from('bars').update({ currency: null }).eq('id', ids.bar);
    const noCurrency = await users.admin.client.from('item_costs').upsert({ bar_id: ids.bar, item_id: ids.rum, pack_cost_minor: 2200 }, { onConflict: 'bar_id,item_id' });
    assert.ok(noCurrency.error, 'no price without a currency');
  });
});
