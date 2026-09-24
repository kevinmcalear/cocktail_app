// Account deletion rules, run through the real API against the local stack.
// Mirrors the delete-account edge function: prepare_account_deletion, then
// remove avatar files, then delete the auth user.
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
  throw new Error(`Refusing to run account deletion tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

const users = {};
const ids = {};

async function makeUser(label) {
  const email = `${label}-${run}@deletion-test.local`;
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

async function exists(table, id) {
  const { data } = await service.from(table).select('id').eq('id', id);
  return data.length === 1;
}

/** What the delete-account edge function does, with the service role. */
async function deleteAccount(userId) {
  const { error } = await service.rpc('prepare_account_deletion', { p_user_id: userId });
  if (error) return error;
  const { data: files } = await service.storage.from('avatars').list(userId);
  if (files?.length) await service.storage.from('avatars').remove(files.map((f) => `${userId}/${f.name}`));
  const { error: deleteError } = await service.auth.admin.deleteUser(userId);
  return deleteError;
}

before(async () => {
  for (const label of ['leaver', 'colleague', 'soleAdmin', 'member']) users[label] = await makeUser(label);

  // A bar the leaver shares with a colleague (both admins).
  ids.sharedBar = (await insert('bars', { name: `Shared ${run}` })).id;
  await insert('user_bars', { user_id: users.leaver.id, bar_id: ids.sharedBar, role_level: 40 });
  await insert('user_bars', { user_id: users.colleague.id, bar_id: ids.sharedBar, role_level: 40 });
  ids.sharedCocktail = (
    await insert('items', { name: `Shared sour ${run}`, item_type: 'cocktail', bar_id: ids.sharedBar, created_by: users.leaver.id })
  ).id;

  // A bar only the leaver belongs to, with content.
  ids.soloBar = (await insert('bars', { name: `Solo ${run}` })).id;
  await insert('user_bars', { user_id: users.leaver.id, bar_id: ids.soloBar, role_level: 40 });
  ids.soloCocktail = (
    await insert('items', { name: `Solo fizz ${run}`, item_type: 'cocktail', bar_id: ids.soloBar, created_by: users.leaver.id })
  ).id;
  ids.soloMenu = (await insert('menus', { name: `Solo menu ${run}`, bar_id: ids.soloBar, created_by: users.leaver.id })).id;
  ids.soloDraft = (
    await insert('drafts', { user_id: users.leaver.id, bar_id: ids.soloBar, entity_type: 'cocktail', draft_data: {} })
  ).id;

  // Personal content.
  ids.personalItem = (
    await insert('items', { name: `Personal syrup ${run}`, item_type: 'ingredient', created_by: users.leaver.id })
  ).id;
  ids.personalMenu = (await insert('menus', { name: `Personal menu ${run}`, created_by: users.leaver.id })).id;
  ids.personalDraft = (
    await insert('drafts', { user_id: users.leaver.id, entity_type: 'cocktail', draft_data: {} })
  ).id;

  // A bar whose only admin has another member.
  ids.guardedBar = (await insert('bars', { name: `Guarded ${run}` })).id;
  await insert('user_bars', { user_id: users.soleAdmin.id, bar_id: ids.guardedBar, role_level: 40 });
  await insert('user_bars', { user_id: users.member.id, bar_id: ids.guardedBar, role_level: 20 });

  // The leaver's avatar and a drink photo they uploaded.
  const { error: avatarError } = await users.leaver.client.storage
    .from('avatars')
    .upload(`${users.leaver.id}/avatar.png`, png, { contentType: 'image/png' });
  if (avatarError) throw avatarError;
  ids.drinkPhoto = `cocktails/${ids.sharedCocktail}/${run}.png`;
  const { error: photoError } = await users.leaver.client.storage
    .from('drinks')
    .upload(ids.drinkPhoto, png, { contentType: 'image/png' });
  if (photoError) throw photoError;
});

after(async () => {
  await service.storage.from('drinks').remove([ids.drinkPhoto]);
  for (const table of ['items', 'menus', 'bars']) {
    await service.from(table).delete().like('name', `%${run}%`);
  }
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
});

describe('account deletion', () => {
  test('signed-in users cannot run the deletion step themselves', async () => {
    const { error } = await users.leaver.client.rpc('prepare_account_deletion', { p_user_id: users.member.id });
    assert.ok(error);
  });

  test('the only admin of a bar with other members is asked to hand over first', async () => {
    const error = await deleteAccount(users.soleAdmin.id);
    assert.ok(error);
    assert.match(error.message, new RegExp(`Make someone else an admin of Guarded ${run}`));
    const { data } = await service.auth.admin.getUserById(users.soleAdmin.id);
    assert.ok(data.user, 'the account must still exist');
  });

  test('deleting an account removes the user, their solo bar, personal menus, drafts and avatar', async () => {
    const error = await deleteAccount(users.leaver.id);
    assert.ifError(error);

    const { data: gone } = await service.auth.admin.getUserById(users.leaver.id);
    assert.equal(gone.user, null);

    assert.equal(await exists('bars', ids.soloBar), false);
    assert.equal(await exists('items', ids.soloCocktail), false);
    assert.equal(await exists('menus', ids.soloMenu), false);
    assert.equal(await exists('drafts', ids.soloDraft), false);
    assert.equal(await exists('menus', ids.personalMenu), false);
    assert.equal(await exists('drafts', ids.personalDraft), false);

    const { data: avatarFiles } = await service.storage.from('avatars').list(users.leaver.id);
    assert.deepEqual(avatarFiles, []);
  });

  test('content in shared bars and shared ingredients stays, anonymised', async () => {
    const { data: shared } = await service.from('items').select('created_by').eq('id', ids.sharedCocktail).single();
    assert.equal(shared.created_by, null);
    const { data: personal } = await service.from('items').select('created_by').eq('id', ids.personalItem).single();
    assert.equal(personal.created_by, null);
    assert.equal(await exists('bars', ids.sharedBar), true);

    const { data: members } = await service.from('user_bars').select('user_id').eq('bar_id', ids.sharedBar);
    assert.deepEqual(members.map((m) => m.user_id), [users.colleague.id]);
  });
});
