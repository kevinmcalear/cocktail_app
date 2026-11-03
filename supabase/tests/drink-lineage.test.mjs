// drink_lineage: a drink's family in one call (hooks/useLineage.ts). It reads
// as the caller, so a drink the reader can't see never shows: not as the
// drink, not up the line, not among the riffs. Runs through the real API
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
  throw new Error(`Refusing to run drink lineage tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const users = {};
const ids = {};

async function makeUser(label) {
  const email = `${label}-${run}@drink-lineage-test.local`;
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

async function lineage(client, id) {
  const { data, error } = await client.rpc('drink_lineage', { p_item_id: id });
  assert.ifError(error);
  return data;
}

before(async () => {
  users.member = await makeUser('member');
  users.outsider = await makeUser('outsider');
  ids.bar = (await insert('bars', { name: `Lineage bar ${run}` })).id;
  await insert('user_bars', { user_id: users.member.id, bar_id: ids.bar, role_level: 30 });
  const drink = (row) => insert('items', { item_type: 'cocktail', bar_id: ids.bar, ...row }).then((r) => r.id);
  const shared = (row) => insert('items', { item_type: 'cocktail', is_catalog: true, ...row }).then((r) => r.id);
  // A staff-only parent, a catalog drink riffed on it, and two riffs on that: one in the catalog, one staff-only.
  ids.parent = await drink({ name: `Staff parent ${run}`, publish_mode: 'private' });
  ids.drink = await shared({ name: `Shared sour ${run}`, based_on_id: ids.parent, based_on_kind: 'riff' });
  ids.sharedRiff = await shared({ name: `A shared riff ${run}`, based_on_id: ids.drink, based_on_kind: 'riff' });
  ids.staffRiff = await drink({ name: `B staff riff ${run}`, publish_mode: 'private', based_on_id: ids.drink, based_on_kind: 'riff' });
});

after(async () => {
  for (const id of [ids.staffRiff, ids.sharedRiff, ids.drink, ids.parent]) if (id) await service.from('items').delete().eq('id', id);
  if (ids.bar) await service.from('bars').delete().eq('id', ids.bar);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
});

describe('drink_lineage', () => {
  test("the bar's staff see the whole line, in the shape the app reads", async () => {
    const l = await lineage(users.member.client, ids.drink);
    assert.equal(l.drink.id, ids.drink);
    assert.equal(l.drink.based_on_kind, 'riff');
    assert.deepEqual(l.drink.credits, []);
    assert.deepEqual(l.ancestors.map((a) => a.id), [ids.parent]);
    assert.deepEqual(l.riffs.map((r) => r.id), [ids.sharedRiff, ids.staffRiff]);
    assert.deepEqual(l.classics, []);
    assert.deepEqual(l.styles, []);
  });

  test("someone outside the bar never sees its staff-only drinks", async () => {
    const l = await lineage(users.outsider.client, ids.drink);
    assert.equal(l.drink.id, ids.drink);
    assert.deepEqual(l.ancestors, [], 'the hidden parent ends the walk up the line');
    assert.deepEqual(l.riffs.map((r) => r.id), [ids.sharedRiff]);
    const hidden = await lineage(users.outsider.client, ids.parent);
    assert.equal(hidden.drink, null);
  });
});
