// A bartender's asks, the team's notices and Off tonight
// (20261205900000_list_asks_notices_off_tonight.sql): a draft is its
// writer's alone; Ask shows it to the menu team, who turn it down or approve
// it; notices are read by whoever reads the list and never edited; Off
// tonight is set by the menu team, for tonight only, and read by the team.
// Nobody outside the bar, and nothing signed out, reads any of it.
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
  throw new Error(`Refusing to run list asks tests against a non-local stack: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const users = {};
const ids = {};
const HOUR = 3600000;
const ago = (ms) => new Date(Date.now() - ms).toISOString();
const ahead = (ms) => new Date(Date.now() + ms).toISOString();

async function makeUser(label) {
  const email = `${label}-${run}@asks-test.local`;
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
  for (const label of ['creator', 'bartender', 'bartender2', 'stranger']) users[label] = await makeUser(label);
  ids.bar = (await insert('bars', { name: `Asks bar ${run}` })).id;
  await insert('user_bars', { user_id: users.creator.id, bar_id: ids.bar, role_level: 35 });
  await insert('user_bars', { user_id: users.bartender.id, bar_id: ids.bar, role_level: 30 });
  await insert('user_bars', { user_id: users.bartender2.id, bar_id: ids.bar, role_level: 30 });
  for (const name of ['negroni', 'martini']) ids[name] = (await insert('items', { name: `${name} ${run}`, item_type: 'cocktail', bar_id: ids.bar })).id;
  ids.menu = (await insert('menus', { bar_id: ids.bar, name: `Live ${run}`, created_by: users.creator.id, starts_at: ago(24 * HOUR) })).id;
  await insert('menu_drinks', { menu_id: ids.menu, item_id: ids.negroni, sort_order: 0 });
});

after(async () => {
  if (ids.menu) await service.from('menus').delete().eq('id', ids.menu);
  for (const name of ['negroni', 'martini']) if (ids[name]) await service.from('items').delete().eq('id', ids[name]);
  if (ids.bar) await service.from('bars').delete().eq('id', ids.bar);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
});

const asksSeenBy = async (who) => {
  const { data, error } = await users[who].client.from('menu_drink_asks').select('id').eq('menu_id', ids.menu);
  assert.ifError(error);
  return data.map((r) => r.id);
};

describe('Asks', () => {
  test('a draft is only its writer\'s', async () => {
    const { data, error } = await users.bartender.client
      .from('menu_drink_asks')
      .insert({ menu_id: ids.menu, item_id: ids.martini, replaces_item_id: ids.negroni })
      .select()
      .single();
    assert.ifError(error);
    assert.equal(data.created_by, users.bartender.id);
    ids.ask = data.id;
    assert.deepEqual(await asksSeenBy('bartender'), [ids.ask]);
    assert.deepEqual(await asksSeenBy('creator'), [], 'the menu team does not see a draft');
    assert.deepEqual(await asksSeenBy('bartender2'), []);
  });

  test('nobody writes an ask as someone else, or on a list they cannot read', async () => {
    const as = await users.bartender2.client.from('menu_drink_asks').insert({ menu_id: ids.menu, item_id: ids.martini, created_by: users.bartender.id });
    assert.ok(as.error, 'not in someone else\'s name');
    const outside = await users.stranger.client.from('menu_drink_asks').insert({ menu_id: ids.menu, item_id: ids.martini });
    assert.ok(outside.error, 'not on another bar\'s list');
    const signedOut = await anon.from('menu_drink_asks').insert({ menu_id: ids.menu, item_id: ids.martini });
    assert.ok(signedOut.error);
  });

  test('Ask shows it to the menu team; only the writer edits it', async () => {
    const other = await users.bartender2.client.from('menu_drink_asks').update({ asked_at: new Date().toISOString() }).eq('id', ids.ask).select();
    assert.equal(other.data?.length ?? 0, 0, 'another bartender cannot ask for them');
    const asked = await users.bartender.client.from('menu_drink_asks').update({ asked_at: new Date().toISOString() }).eq('id', ids.ask).select();
    assert.ifError(asked.error);
    assert.equal(asked.data.length, 1);
    assert.deepEqual(await asksSeenBy('creator'), [ids.ask], 'waiting for the menu team');
    assert.deepEqual(await asksSeenBy('bartender2'), [], 'still not the rest of the team');
    const team = await users.creator.client.from('menu_drink_asks').update({ price: '20' }).eq('id', ids.ask).select();
    assert.equal(team.data?.length ?? 0, 0, 'the menu team approves or turns down, not edits');
  });

  test('the menu team turns it down; the writer withdraws a draft', async () => {
    const outsider = await users.bartender2.client.from('menu_drink_asks').delete().eq('id', ids.ask).select();
    assert.equal(outsider.data?.length ?? 0, 0);
    const down = await users.creator.client.from('menu_drink_asks').delete().eq('id', ids.ask).select();
    assert.ifError(down.error);
    assert.equal(down.data.length, 1);

    const draft = await users.bartender.client.from('menu_drink_asks').insert({ menu_id: ids.menu, item_id: ids.martini }).select().single();
    assert.ifError(draft.error);
    const notYet = await users.creator.client.from('menu_drink_asks').delete().eq('id', draft.data.id).select();
    assert.equal(notYet.data?.length ?? 0, 0, 'the menu team cannot remove a draft they cannot see');
    const withdrawn = await users.bartender.client.from('menu_drink_asks').delete().eq('id', draft.data.id).select();
    assert.equal(withdrawn.data.length, 1);
  });
});

describe('Notices', () => {
  test('whoever made the change tells the team; everyone on the list reads it; nobody edits it', async () => {
    const told = await users.creator.client
      .from('menu_list_notices')
      .insert({ menu_id: ids.menu, item_id: ids.negroni, kind: 'swap', to_item_id: ids.martini })
      .select()
      .single();
    assert.ifError(told.error);
    assert.equal(told.data.told_by, users.creator.id);
    const read = await users.bartender2.client.from('menu_list_notices').select('id, kind').eq('menu_id', ids.menu);
    assert.ifError(read.error);
    assert.deepEqual(read.data.map((n) => n.kind), ['swap']);
    const edit = await users.creator.client.from('menu_list_notices').update({ kind: 'on' }).eq('id', told.data.id).select();
    assert.equal(edit.data?.length ?? 0, 0, 'never edited');
    const gone = await users.creator.client.from('menu_list_notices').delete().eq('id', told.data.id).select();
    assert.equal(gone.data?.length ?? 0, 0, 'never deleted');
  });

  test('a swap names what went on; nobody outside reads or writes them', async () => {
    const noTo = await users.creator.client.from('menu_list_notices').insert({ menu_id: ids.menu, item_id: ids.negroni, kind: 'swap' });
    assert.ok(noTo.error);
    const outside = await users.stranger.client.from('menu_list_notices').select('id').eq('menu_id', ids.menu);
    assert.deepEqual(outside.data ?? [], []);
    const outsideWrite = await users.stranger.client.from('menu_list_notices').insert({ menu_id: ids.menu, item_id: ids.negroni, kind: 'off' });
    assert.ok(outsideWrite.error);
    const signedOut = await anon.from('menu_list_notices').select('id').eq('menu_id', ids.menu);
    assert.deepEqual(signedOut.data ?? [], []);
  });
});

describe('Off tonight', () => {
  test('the menu team pulls a drink until close; the team reads it', async () => {
    const off = await users.creator.client.from('menu_off_tonight').insert({ menu_id: ids.menu, item_id: ids.negroni, until: ahead(6 * HOUR) }).select().single();
    assert.ifError(off.error);
    ids.off = off.data.id;
    const read = await users.bartender.client.from('menu_off_tonight').select('item_id').eq('menu_id', ids.menu);
    assert.deepEqual(read.data.map((r) => r.item_id), [ids.negroni]);
    const { data: rows } = await service.from('menu_drinks').select('off_at').eq('menu_id', ids.menu);
    assert.deepEqual(rows.map((r) => r.off_at), [null], 'the list and its run are untouched');
  });

  test('tonight only, and not by the rest of the team (yet) or anyone outside', async () => {
    const past = await users.creator.client.from('menu_off_tonight').insert({ menu_id: ids.menu, item_id: ids.martini, until: ago(HOUR) });
    assert.ok(past.error, 'not a close that has passed');
    const far = await users.creator.client.from('menu_off_tonight').insert({ menu_id: ids.menu, item_id: ids.martini, until: ahead(72 * HOUR) });
    assert.ok(far.error, 'not days ahead');
    const bartender = await users.bartender.client.from('menu_off_tonight').insert({ menu_id: ids.menu, item_id: ids.martini, until: ahead(HOUR) });
    assert.ok(bartender.error, 'a bartender asks the menu team for now');
    const clear = await users.bartender.client.from('menu_off_tonight').delete().eq('id', ids.off).select();
    assert.equal(clear.data?.length ?? 0, 0);
    const outside = await users.stranger.client.from('menu_off_tonight').select('id').eq('menu_id', ids.menu);
    assert.deepEqual(outside.data ?? [], []);
    const signedOut = await anon.from('menu_off_tonight').select('id').eq('menu_id', ids.menu);
    assert.deepEqual(signedOut.data ?? [], []);
  });

  test('the menu team puts it back', async () => {
    const back = await users.creator.client.from('menu_off_tonight').delete().eq('id', ids.off).select();
    assert.equal(back.data.length, 1);
  });
});
