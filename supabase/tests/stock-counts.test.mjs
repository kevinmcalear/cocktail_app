// Stock counts: the prep crew counts, members who see the back bar read,
// and stock_on_hand is the latest line per spot. Runs through the real API
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
  throw new Error(`Refusing to run stock count tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);

// locations opens at Employee (20); prep at Drink Creator (35).
const ROLES = { guest: 10, employee: 20, creator: 35 };
const users = {};
const ids = {};

async function makeUser(label) {
  const email = `${label}-${run}@stock-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: 'Sam Counter' } });
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
  ids.bar = (await insert('bars', { name: `Count bar ${run}` })).id;
  for (const [label, role] of Object.entries(ROLES)) {
    await insert('user_bars', { user_id: users[label].id, bar_id: ids.bar, role_level: role });
  }
  ids.zone = (await insert('bar_zones', { bar_id: ids.bar, name: `Fridge ${run}`, kind: 'fridge' })).id;
  ids.vermouth = (await insert('items', { name: `Dry vermouth ${run}`, item_type: 'ingredient' })).id;
  ids.spot = (await insert('item_locations', { bar_id: ids.bar, item_id: ids.vermouth, zone_id: ids.zone, shelf: 'top', par_amount: 2, par_unit: 'btl' })).id;
});

after(async () => {
  if (ids.vermouth) await service.from('items').delete().eq('id', ids.vermouth);
  if (ids.bar) await service.from('bars').delete().eq('id', ids.bar);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
});

describe('stock counts', () => {
  test('the prep crew records a count with their name on it; an employee cannot', async () => {
    const asEmployee = await users.employee.client.from('stock_counts').insert({ bar_id: ids.bar, zone_id: ids.zone, counted_by: users.employee.id });
    assert.ok(asEmployee.error, 'counting needs prep');
    const { data: count, error } = await users.creator.client.from('stock_counts').insert({ bar_id: ids.bar, zone_id: ids.zone, counted_by: users.creator.id }).select('id, counted_by_name').single();
    assert.ifError(error);
    assert.equal(count.counted_by_name, 'Sam Counter');
    ids.count = count.id;
    const lines = await users.creator.client.from('stock_count_lines').insert({ count_id: count.id, item_id: ids.vermouth, location_id: ids.spot, amount: 1.4, unit: 'btl' });
    assert.ifError(lines.error);
    const forged = await users.creator.client.from('stock_counts').insert({ bar_id: ids.bar, zone_id: ids.zone, counted_by: users.employee.id });
    assert.ok(forged.error, 'a count is signed by whoever saves it');
    const negative = await service.from('stock_count_lines').insert({ count_id: count.id, item_id: ids.vermouth, location_id: null, amount: -1, unit: 'btl' });
    assert.ok(negative.error, 'a negative count is refused');
  });

  test('members who see the back bar read counts; a guest and an outsider do not', async () => {
    const asEmployee = await users.employee.client.from('stock_count_lines').select('amount').eq('count_id', ids.count);
    assert.ifError(asEmployee.error);
    assert.equal(Number(asEmployee.data[0].amount), 1.4);
    for (const who of ['guest', 'outsider']) {
      const { data, error } = await users[who].client.from('stock_counts').select('id').eq('bar_id', ids.bar);
      assert.ifError(error);
      assert.equal(data.length, 0, who);
    }
  });

  test('stock_on_hand is the latest line per spot', async () => {
    const later = await users.creator.client.from('stock_counts').insert({ bar_id: ids.bar, zone_id: ids.zone, counted_by: users.creator.id, counted_at: new Date(Date.now() + 60_000).toISOString() }).select('id').single();
    assert.ifError(later.error);
    await users.creator.client.from('stock_count_lines').insert({ count_id: later.data.id, item_id: ids.vermouth, location_id: ids.spot, amount: 0.5, unit: 'btl' });
    const { data, error } = await users.employee.client.rpc('stock_on_hand', { p_bar: ids.bar });
    assert.ifError(error);
    assert.equal(data.length, 1);
    assert.equal(Number(data[0].amount), 0.5);
    const outsider = await users.outsider.client.rpc('stock_on_hand', { p_bar: ids.bar });
    assert.ifError(outsider.error);
    assert.equal(outsider.data.length, 0);
  });
});
