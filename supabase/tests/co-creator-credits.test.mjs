// A co-creator's credit waits for their yes (20261121200000_co_credits_wait_for_yes.sql):
// naming yourself is accepted, naming anyone else (or an unclaimed page) is
// pending until that person accepts. Until then only they, the drink's editors
// and moderators see it. Only the person named answers. Runs through the real API.
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
  throw new Error(`Refusing to run co-creator credit tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const users = {};
const ids = {};

async function makeUser(label) {
  const email = `${label}-${run}@security-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

async function serviceInsert(table, row) {
  const { data, error } = await service.from(table).insert(row).select().single();
  if (error) throw new Error(`fixture insert into ${table} failed: ${error.message}`);
  return data;
}

const statusOf = async (itemId, profileId) =>
  (await service.from('item_co_creators').select('status').eq('item_id', itemId).eq('profile_id', profileId).maybeSingle()).data?.status ?? null;
const seenBy = async (who, itemId) =>
  ((await users[who].client.from('item_co_creators').select('profile_id').eq('item_id', itemId)).data ?? []).map((r) => r.profile_id).sort();
const toCheck = async (who) => {
  const { data, error } = await users[who].client.rpc('credits_to_check');
  if (error) throw error;
  return data;
};

before(async () => {
  await db.connect();
  for (const label of ['editor', 'bartender', 'jo', 'sam', 'stranger', 'moderator']) users[label] = await makeUser(label);
  ids.venue = (await serviceInsert('bars', { name: `Credit Bar ${run}` })).id;
  await service.from('user_bars').insert([
    { user_id: users.editor.id, bar_id: ids.venue, role_level: 40 },
    { user_id: users.bartender.id, bar_id: ids.venue, role_level: 20 },
  ]);
  ids.editor = (await serviceInsert('profiles', { kind: 'person', handle: `ed${run}`, display_name: 'Ed', is_public: true, user_id: users.editor.id })).id;
  ids.jo = (await serviceInsert('profiles', { kind: 'person', handle: `jo${run}`, display_name: 'Jo', is_public: true, user_id: users.jo.id })).id;
  // A page the bar made for a bartender who hasn't joined yet.
  ids.sam = (await serviceInsert('profiles', { kind: 'person', handle: `sam${run}`, display_name: 'Sam', is_public: true })).id;
  ids.legend = (await serviceInsert('profiles', { kind: 'person', handle: `legend${run}`, display_name: 'Legend', is_public: true })).id;
  ids.drink = (await serviceInsert('items', { name: `Credit Riff ${run}`, item_type: 'cocktail', bar_id: ids.venue, creator_profile_id: ids.editor })).id;
  ids.seeded = (await serviceInsert('items', { name: `Seeded Riff ${run}`, item_type: 'cocktail', bar_id: ids.venue })).id;
  await db.query('INSERT INTO private.app_admins (user_id) VALUES ($1)', [users.moderator.id]);
});

after(async () => {
  await service.from('items').delete().in('id', [ids.drink, ids.seeded].filter(Boolean));
  await service.from('profiles').delete().in('id', [ids.editor, ids.jo, ids.sam, ids.legend].filter(Boolean));
  if (ids.venue) await service.from('bars').delete().eq('id', ids.venue);
  if (users.moderator) await db.query('DELETE FROM private.app_admins WHERE user_id = $1', [users.moderator.id]);
  await db.end();
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
});

describe('co-creator credits wait for a yes', () => {
  test('SQL and the service role write accepted credits, as the backfill did', async () => {
    await serviceInsert('item_co_creators', { item_id: ids.seeded, profile_id: ids.legend });
    assert.equal(await statusOf(ids.seeded, ids.legend), 'accepted');
  });

  test('the junior bartender sees the drink, so the visibility checks below mean something', async () => {
    const { data } = await users.bartender.client.from('items').select('id').eq('id', ids.drink);
    assert.equal(data?.length, 1);
    assert.deepEqual(await seenBy('bartender', ids.seeded), [ids.legend], 'and accepted credits read as before');
  });

  test('naming yourself is accepted; naming someone with an account waits for them', async () => {
    const self = await users.editor.client.from('item_co_creators').insert({ item_id: ids.seeded, profile_id: ids.editor });
    assert.equal(self.error, null);
    assert.equal(await statusOf(ids.seeded, ids.editor), 'accepted');

    // Asking for accepted doesn't make it so.
    const jo = await users.editor.client.from('item_co_creators').insert({ item_id: ids.drink, profile_id: ids.jo, status: 'accepted' });
    assert.equal(jo.error, null);
    assert.equal(await statusOf(ids.drink, ids.jo), 'pending');
  });

  test('a pending credit is seen by the person named and the drink’s editors, not by others', async () => {
    assert.deepEqual(await seenBy('bartender', ids.drink), [], 'the venue’s junior staff don’t see it yet');
    assert.deepEqual(await seenBy('editor', ids.drink), [ids.jo], 'the editor who named them does');
    assert.deepEqual(await seenBy('jo', ids.drink), [], 'Jo can’t read this venue’s drinks, so finds it in credits_to_check instead');
    const signedOut = await anon.from('item_co_creators').select('profile_id').eq('item_id', ids.drink);
    assert.deepEqual(signedOut.data ?? [], []);
  });

  test('credits_to_check lists only the signed-in person’s pending credits, with the drink’s name', async () => {
    const jo = await toCheck('jo');
    assert.equal(jo.length, 1);
    assert.equal(jo[0].item_id, ids.drink);
    assert.equal(jo[0].name, `Credit Riff ${run}`);
    assert.equal(jo[0].creator_name, 'Ed');
    assert.equal(jo[0].bar_name, `Credit Bar ${run}`, 'Jo can’t read this venue’s drinks, but sees what they were named on');
    assert.deepEqual(await toCheck('editor'), [], 'an accepted credit isn’t waiting');
    assert.deepEqual(await toCheck('stranger'), []);
    const signedOut = await anon.rpc('credits_to_check');
    assert.ok(signedOut.error, 'signed out, there is nothing to check');
  });

  test('only the person named answers, and only through answer_credit', async () => {
    for (const who of ['editor', 'stranger']) {
      const { error } = await users[who].client.rpc('answer_credit', { p_item_id: ids.drink, p_accept: true });
      assert.ok(error, `${who} isn’t named, so can’t accept for Jo`);
    }
    await users.editor.client.from('item_co_creators').update({ status: 'accepted' }).eq('item_id', ids.drink).eq('profile_id', ids.jo);
    await users.jo.client.from('item_co_creators').update({ status: 'accepted' }).eq('item_id', ids.drink).eq('profile_id', ids.jo);
    assert.equal(await statusOf(ids.drink, ids.jo), 'pending', 'no one updates the row directly');
    const signedOut = await anon.rpc('answer_credit', { p_item_id: ids.drink, p_accept: true });
    assert.ok(signedOut.error);
    assert.equal(await statusOf(ids.drink, ids.jo), 'pending');
  });

  test('accepting shows the credit to everyone who sees the drink; declining hides it again', async () => {
    const yes = await users.jo.client.rpc('answer_credit', { p_item_id: ids.drink, p_accept: true });
    assert.equal(yes.error, null);
    assert.equal(yes.data, 'accepted');
    assert.deepEqual(await seenBy('bartender', ids.drink), [ids.jo]);
    assert.deepEqual(await toCheck('jo'), []);

    const no = await users.jo.client.rpc('answer_credit', { p_item_id: ids.drink, p_accept: false });
    assert.equal(no.data, 'declined');
    assert.deepEqual(await seenBy('bartender', ids.drink), []);
    assert.deepEqual(await seenBy('editor', ids.drink), [ids.jo], 'the editor sees the no');

    const again = await users.editor.client.from('item_co_creators').insert({ item_id: ids.drink, profile_id: ids.jo });
    assert.ok(again.error, 'and can’t name Jo a second time');
    assert.equal(await statusOf(ids.drink, ids.jo), 'declined');
  });

  test('a page nobody has claimed waits until whoever claims it says yes', async () => {
    const add = await users.editor.client.from('item_co_creators').insert({ item_id: ids.drink, profile_id: ids.sam });
    assert.equal(add.error, null);
    assert.equal(await statusOf(ids.drink, ids.sam), 'pending');
    assert.deepEqual(await seenBy('bartender', ids.drink), []);

    // Sam joins and the page becomes theirs: the credit is still waiting, now for them.
    const claim = await service.from('profiles').update({ user_id: users.sam.id }).eq('id', ids.sam);
    assert.equal(claim.error, null);
    assert.deepEqual((await toCheck('sam')).map((r) => r.item_id), [ids.drink]);
    const yes = await users.sam.client.rpc('answer_credit', { p_item_id: ids.drink, p_accept: true });
    assert.equal(yes.data, 'accepted');
    assert.deepEqual(await seenBy('bartender', ids.drink), [ids.sam]);
  });

  test('a moderator crediting an unclaimed page is accepted; crediting someone with an account still waits', async () => {
    const legend = await users.moderator.client.from('item_co_creators').insert({ item_id: ids.drink, profile_id: ids.legend });
    assert.equal(legend.error, null);
    assert.equal(await statusOf(ids.drink, ids.legend), 'accepted', 'historic people never claim, so research credits show');

    const own = await users.moderator.client.rpc('answer_credit', { p_item_id: ids.drink, p_accept: true });
    assert.ok(own.error, 'a moderator isn’t named, so can’t answer for anyone');

    const jo = await users.moderator.client.from('item_co_creators').insert({ item_id: ids.seeded, profile_id: ids.jo });
    assert.equal(jo.error, null);
    assert.equal(await statusOf(ids.seeded, ids.jo), 'pending');
  });
});
