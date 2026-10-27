// A drink made in parts (20261123100000_drink_parts.sql): save_drink_spec
// saves each line's and method's part and the parts, only for someone who
// can edit the drink; a save that leaves parts out keeps them; the parts'
// shape is checked; versions put them back. Runs through the real API
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
  throw new Error(`Refusing to run drink parts tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const users = {};
const ids = {};

async function makeUser(label) {
  const email = `${label}-${run}@drink-parts-test.local`;
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

const line = (ingredient_item_id, amount, part) => ({ ingredient_item_id, amount, unit: 'ml', preparation_notes: null, is_optional: false, ...(part ? { part } : {}) });
const PARTS = [{ name: 'The coffee' }, { name: 'The cream', join: 'float' }];

async function spec() {
  const [{ data: item }, { data: lines }, { data: methods }] = await Promise.all([
    service.from('items').select('parts').eq('id', ids.drink).single(),
    service.from('recipes').select('id, ingredient_item_id, part').eq('recipe_item_id', ids.drink).order('sort_order'),
    service.from('item_methods').select('method_item_id, part').eq('item_id', ids.drink).order('sort_order'),
  ]);
  return { parts: item.parts, lines, methods };
}

before(async () => {
  users.admin = await makeUser('admin');
  users.outsider = await makeUser('outsider');
  ids.bar = (await insert('bars', { name: `Parts bar ${run}` })).id;
  await insert('user_bars', { user_id: users.admin.id, bar_id: ids.bar, role_level: 40 });
  ids.build = (await insert('items', { name: `Build ${run}`, item_type: 'method' })).id;
  ids.whisk = (await insert('items', { name: `Whip (whisk or frother) ${run}`, item_type: 'method' })).id;
  ids.whiskey = (await insert('items', { name: `Irish whiskey ${run}`, item_type: 'ingredient' })).id;
  ids.coffee = (await insert('items', { name: `Hot coffee ${run}`, item_type: 'ingredient' })).id;
  ids.cream = (await insert('items', { name: `Cream ${run}`, item_type: 'ingredient' })).id;
  ids.drink = (await insert('items', { name: `Irish Coffee ${run}`, item_type: 'cocktail', bar_id: ids.bar })).id;
});

after(async () => {
  await service.from('items').delete().eq('id', ids.drink);
  await service.from('items').delete().in('id', [ids.build, ids.whisk, ids.whiskey, ids.coffee, ids.cream]);
  await service.from('bars').delete().eq('id', ids.bar);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
});

describe('save_drink_spec with parts', () => {
  test('the venue saves two parts, with Build in both', async () => {
    const { error } = await users.admin.client.rpc('save_drink_spec', {
      p_item: ids.drink,
      p_lines: [line(ids.whiskey, 40, 1), line(ids.coffee, 120, 1), line(ids.cream, 30, 2)],
      p_method_ids: [ids.build, ids.build, ids.whisk],
      p_method_parts: [1, 2, 2],
      p_note: null,
      p_parts: PARTS,
    });
    assert.ifError(error);
    const s = await spec();
    assert.deepEqual(s.parts, PARTS);
    assert.deepEqual(s.lines.map((l) => l.part), [1, 1, 2]);
    assert.deepEqual(s.methods, [
      { method_item_id: ids.build, part: 1 },
      { method_item_id: ids.build, part: 2 },
      { method_item_id: ids.whisk, part: 2 },
    ]);
  });

  test('a save that leaves parts out (the drink editor) keeps them', async () => {
    const before = await spec();
    const { error } = await users.admin.client.rpc('save_drink_spec', {
      p_item: ids.drink,
      p_lines: before.lines.map((l) => ({ ...line(l.ingredient_item_id, 45), id: l.id })),
      p_method_ids: [ids.build, ids.whisk],
      p_note: 'Edited',
    });
    assert.ifError(error);
    const s = await spec();
    assert.deepEqual(s.parts, PARTS);
    assert.deepEqual(s.lines.map((l) => l.part), [1, 1, 2]);
    assert.deepEqual(s.methods.map((m) => [m.method_item_id, m.part]), [[ids.build, 1], [ids.build, 2], [ids.whisk, 2]], 'Build stays in both parts');
  });

  test('an outsider and a signed-out caller are refused', async () => {
    const args = { p_item: ids.drink, p_lines: [], p_method_ids: [], p_note: null, p_parts: null };
    const { error } = await users.outsider.client.rpc('save_drink_spec', args);
    assert.equal(error?.code, '42501');
    const { error: anonError } = await anon.rpc('save_drink_spec', args);
    assert.ok(anonError, 'anon may not call it');
    assert.equal((await spec()).lines.length, 3, 'nothing changed');
  });

  test('parts and part numbers are checked', async () => {
    const save = (patch) => users.admin.client.rpc('save_drink_spec', { p_item: ids.drink, p_lines: [line(ids.whiskey, 40, 1)], p_method_ids: [], p_note: null, ...patch });
    for (const parts of [[{ name: 'Only one' }], [{ name: 'First', join: 'float' }, { name: 'Second' }], [{ name: 'A' }, { name: 'B', join: 'shake' }], [{ name: 'A' }, { name: 'B', colour: 'red' }], [{ name: ' ' }, { name: 'B' }]]) {
      const { error } = await save({ p_parts: parts });
      assert.ok(error, `refused: ${JSON.stringify(parts)}`);
    }
    const { error: tooFar } = await save({ p_lines: [line(ids.whiskey, 40, 3)] });
    assert.match(tooFar?.message ?? '', /part 3/);
    const { error: methodTooFar } = await save({ p_method_ids: [ids.build], p_method_parts: [3] });
    assert.ok(methodTooFar);
    const { error: direct } = await users.admin.client.from('items').update({ parts: [{ name: 'Only one' }] }).eq('id', ids.drink);
    assert.ok(direct, 'the table checks the shape too');
    assert.deepEqual((await spec()).parts, PARTS, 'nothing changed');
  });

  test('back to one part, and a version puts the parts back', async () => {
    const { error } = await users.admin.client.rpc('save_drink_spec', {
      p_item: ids.drink, p_lines: [line(ids.whiskey, 40, 1)], p_method_ids: [ids.build], p_method_parts: [1], p_note: 'One part', p_parts: [],
    });
    assert.ifError(error);
    assert.equal((await spec()).parts, null);
    const { data: versions } = await service.from('item_versions').select('version, note').eq('item_id', ids.drink).order('version');
    const twoParts = versions.find((v) => v.note === 'Edited').version;
    const { error: restoreError } = await users.admin.client.rpc('restore_drink_version', { p_item: ids.drink, p_version: twoParts });
    assert.ifError(restoreError);
    const s = await spec();
    assert.deepEqual(s.parts, PARTS);
    assert.deepEqual(s.lines.map((l) => l.part), [1, 1, 2]);
    assert.deepEqual(s.methods.map((m) => m.part), [1, 2, 2]);
  });
});

// A later part made fresh for each serve (20261126200000_part_made_fresh.sql):
// the batch sheet sets it straight on items.parts, for whoever can edit the drink.
describe('a part made fresh', () => {
  const FRESH = [{ name: 'The coffee' }, { name: 'The cream', join: 'float', fresh: true }];

  test('the venue marks the cream made fresh, and back to made ahead', async () => {
    const { error } = await users.admin.client.from('items').update({ parts: FRESH }).eq('id', ids.drink).select('id').single();
    assert.ifError(error);
    assert.deepEqual((await spec()).parts, FRESH);
    const { error: backError } = await users.admin.client.from('items').update({ parts: PARTS }).eq('id', ids.drink).select('id').single();
    assert.ifError(backError);
    assert.deepEqual((await spec()).parts, PARTS);
  });

  test('a save_drink_spec with fresh keeps it, and its version does too', async () => {
    const before = await spec();
    const { error } = await users.admin.client.rpc('save_drink_spec', {
      p_item: ids.drink,
      p_lines: before.lines.map((l) => ({ ...line(l.ingredient_item_id, 40), id: l.id })),
      p_method_ids: [ids.build, ids.whisk],
      p_method_parts: [1, 2],
      p_note: 'Cream to order',
      p_parts: FRESH,
    });
    assert.ifError(error);
    assert.deepEqual((await spec()).parts, FRESH);
    const { data: version } = await service.from('item_versions').select('snapshot').eq('item_id', ids.drink).eq('note', 'Cream to order').single();
    assert.deepEqual(version.snapshot.parts, FRESH, 'the version keeps it');
  });

  test('fresh must be true or false, and an outsider cannot set it', async () => {
    const { error } = await users.admin.client.from('items').update({ parts: [{ name: 'A' }, { name: 'B', fresh: 'yes' }] }).eq('id', ids.drink);
    assert.ok(error, 'a string is refused');
    const { data } = await users.outsider.client.from('items').update({ parts: PARTS }).eq('id', ids.drink).select('id');
    assert.equal(data?.length ?? 0, 0, 'the outsider changed nothing');
    assert.deepEqual((await spec()).parts, FRESH);
  });
});
