// Spec versions and team notes: save_drink_spec versions the spec in the
// same transaction, versions read with the specs capability, restore puts
// an old one back as a new one, and notes are the venue's own, screened by
// the content filter. Runs through the real API against the local stack.
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
  throw new Error(`Refusing to run version tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

// Bar defaults: measurement (specs) opens at 30; talking points at 20; edit_drinks at 35.
const ROLES = { employee: 20, bartender: 30, creator: 35, admin: 40 };
const users = {};
const ids = {};

async function makeUser(label) {
  const email = `${label}-${run}@versions-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: `${label[0].toUpperCase()}${label.slice(1)} Tester` } });
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

const line = (ingredient_item_id, amount, unit, id = null) => ({ id, ingredient_item_id, amount, unit, preparation_notes: null, is_optional: false });

async function versions(client) {
  const { data, error } = await client.from('item_versions').select('version, note, snapshot, created_by_name').eq('item_id', ids.drink).order('version');
  assert.ifError(error);
  return data;
}

before(async () => {
  await db.connect();
  for (const label of [...Object.keys(ROLES), 'outsider']) users[label] = await makeUser(label);
  ids.bar = (await insert('bars', { name: `Version bar ${run}` })).id;
  for (const [label, role] of Object.entries(ROLES)) {
    await insert('user_bars', { user_id: users[label].id, bar_id: ids.bar, role_level: role });
  }
  ids.stir = (await insert('items', { name: `Stir ${run}`, item_type: 'method' })).id;
  ids.shake = (await insert('items', { name: `Shake ${run}`, item_type: 'method' })).id;
  ids.bourbon = (await insert('items', { name: `Bourbon ${run}`, item_type: 'ingredient' })).id;
  ids.demerara = (await insert('items', { name: `Demerara syrup ${run}`, item_type: 'ingredient' })).id;
  ids.saline = (await insert('items', { name: `Saline ${run}`, item_type: 'ingredient' })).id;
  ids.drink = (await insert('items', { name: `Old Fashioned ${run}`, item_type: 'cocktail', bar_id: ids.bar })).id;
  await insert('item_methods', { item_id: ids.drink, method_item_id: ids.stir, sort_order: 0 });
  ids.bourbonLine = (await insert('recipes', { recipe_item_id: ids.drink, ingredient_item_id: ids.bourbon, amount: 60, unit: 'ml', sort_order: 1, at_service: false })).id;
  ids.demeraraLine = (await insert('recipes', { recipe_item_id: ids.drink, ingredient_item_id: ids.demerara, amount: 7.5, unit: 'g', sort_order: 2 })).id;
});

after(async () => {
  for (const id of [ids.drink, ids.bourbon, ids.demerara, ids.saline, ids.stir, ids.shake]) if (id) await service.from('items').delete().eq('id', id);
  if (ids.bar) await service.from('bars').delete().eq('id', ids.bar);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
  await db.end();
});

describe('save_drink_spec', () => {
  test('a bartender without edit rights is refused', async () => {
    const { error } = await users.bartender.client.rpc('save_drink_spec', { p_item: ids.drink, p_lines: [line(ids.bourbon, 60, 'ml', ids.bourbonLine)], p_method_id: ids.stir, p_note: null });
    assert.ok(error, 'refused');
  });

  test('the first save records how it was, then the change, in one go', async () => {
    const { data: version, error } = await users.creator.client.rpc('save_drink_spec', {
      p_item: ids.drink,
      p_lines: [line(ids.bourbon, 60, 'ml', ids.bourbonLine), line(ids.demerara, 6, 'g', ids.demeraraLine), line(ids.saline, 1, 'dash')],
      p_method_id: ids.stir,
      p_note: 'Less sugar, a dash of saline',
    });
    assert.ifError(error);
    assert.equal(version, 2);
    const v = await versions(users.bartender.client);
    assert.deepEqual(v.map((x) => x.version), [1, 2], 'a bartender reads the versions');
    assert.equal(v[0].note, 'As it was before versions were kept');
    assert.deepEqual(v[0].snapshot.lines.map((l) => [l.amount, l.unit]), [[60, 'ml'], [7.5, 'g']]);
    assert.deepEqual(v[1].snapshot.lines.map((l) => [l.amount, l.unit]), [[60, 'ml'], [6, 'g'], [1, 'dash']]);
    assert.equal(v[1].snapshot.lines[0].at_service, false, 'a kept line keeps its service decision');
    assert.equal(v[1].snapshot.methods[0], `Stir ${run}`);
    assert.equal(v[1].created_by_name, 'Creator Tester');
    const rows = await service.from('recipes').select('id, amount, sort_order').eq('recipe_item_id', ids.drink).order('sort_order');
    assert.equal(rows.data.length, 3);
    assert.equal(rows.data[0].id, ids.bourbonLine, 'kept rows keep their ids');
  });

  test('saving the same spec again adds no version', async () => {
    const { data: version, error } = await users.creator.client.rpc('save_drink_spec', {
      p_item: ids.drink,
      p_lines: [line(ids.bourbon, 60, 'ml', ids.bourbonLine), line(ids.demerara, 6, 'g', ids.demeraraLine), line(ids.saline, 1, 'dash')],
      p_method_id: ids.stir,
      p_note: null,
    });
    assert.ifError(error);
    assert.equal(version, 2);
  });

  test('an employee below the specs level and an outsider see no versions', async () => {
    for (const who of ['employee', 'outsider']) {
      const { data, error } = await users[who].client.from('item_versions').select('version').eq('item_id', ids.drink);
      assert.ifError(error);
      assert.equal(data.length, 0, who);
    }
    const direct = await users.creator.client.from('item_versions').insert({ item_id: ids.drink, version: 9, snapshot: {} });
    assert.ok(direct.error, 'only the RPCs write versions');
  });

  test('restore puts version 1 back as version 3', async () => {
    const { data: version, error } = await users.creator.client.rpc('restore_drink_version', { p_item: ids.drink, p_version: 1 });
    assert.ifError(error);
    assert.equal(version, 3);
    const rows = await service.from('recipes').select('amount, unit').eq('recipe_item_id', ids.drink).order('sort_order');
    assert.deepEqual(rows.data.map((r) => [Number(r.amount), r.unit]), [[60, 'ml'], [7.5, 'g']]);
    const v = await versions(users.creator.client);
    assert.equal(v[2].note, 'Restored version 1');
    const asBartender = await users.bartender.client.rpc('restore_drink_version', { p_item: ids.drink, p_version: 1 });
    assert.ok(asBartender.error, 'restoring needs edit rights');
  });
});

describe('item_comments', () => {
  test('employees and up write and read notes at their venue, with their name on', async () => {
    const posted = await users.employee.client.from('item_comments').insert({ item_id: ids.drink, bar_id: ids.bar, body: 'Saline fixed the flat finish.', version: 2 }).select('id, author_name').single();
    assert.ifError(posted.error);
    assert.equal(posted.data.author_name, 'Employee Tester');
    ids.note = posted.data.id;
    const { data, error } = await users.bartender.client.from('item_comments').select('body').eq('item_id', ids.drink);
    assert.ifError(error);
    assert.deepEqual(data.map((c) => c.body), ['Saline fixed the flat finish.']);
    const outsider = await users.outsider.client.from('item_comments').select('body').eq('item_id', ids.drink);
    assert.ifError(outsider.error);
    assert.equal(outsider.data.length, 0);
    const forged = await users.employee.client.from('item_comments').insert({ item_id: ids.drink, bar_id: ids.bar, body: 'x', author_id: users.admin.id });
    assert.ok(forged.error, 'a note is signed by whoever posts it');
  });

  test('the content filter screens a note', async () => {
    const { rows } = await db.query("SELECT word FROM private.screened_words WHERE kind = 'word' LIMIT 1");
    const { error } = await users.employee.client.from('item_comments').insert({ item_id: ids.drink, bar_id: ids.bar, body: `Tastes like ${rows[0].word} to me` });
    assert.ok(error, 'refused');
    assert.match(error.message, /word we don't allow/);
  });

  test('you edit your own; an admin deletes anyone’s; a bartender can’t delete another’s', async () => {
    const edited = await users.employee.client.from('item_comments').update({ body: 'Saline fixed the flat finish. Guests ask for it.' }).eq('id', ids.note).select('updated_at').single();
    assert.ifError(edited.error);
    assert.ok(edited.data.updated_at);
    const asBartender = await users.bartender.client.from('item_comments').delete().eq('id', ids.note).select('id');
    assert.ok(asBartender.error || asBartender.data.length === 0);
    const asAdmin = await users.admin.client.from('item_comments').delete().eq('id', ids.note).select('id');
    assert.ifError(asAdmin.error);
    assert.equal(asAdmin.data.length, 1);
  });

  test('a note can be reported', async () => {
    const posted = await users.bartender.client.from('item_comments').insert({ item_id: ids.drink, bar_id: ids.bar, body: 'Try 5 g next.' }).select('id').single();
    assert.ifError(posted.error);
    const report = await users.employee.client.from('reports').insert({ target_kind: 'comment', comment_id: posted.data.id, reason: 'harassment' }).select('id').single();
    assert.ifError(report.error);
    await service.from('reports').delete().eq('id', report.data.id);
  });
});
