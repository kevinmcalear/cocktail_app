// Takeovers (20261204400000_takeovers_and_allergens.sql): a takeover list's
// guest bar reads it and its run sheet while it runs; guest bartenders on a
// role that ends change it directly, without the menus permission, and lose
// it when the role ends; an invite can carry that role and never moves an
// existing member; a takeover's nights are takeover events; a run-sheet
// link per party reads signed out until 14 days after the list ends. Runs
// through the real API against the local stack.
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
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL) || !/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost)[:/]/.test(status.DB_URL)) {
  throw new Error(`Refusing to run takeover tests against a non-local stack: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });
const users = {};
const ids = {};
const DAY = 86400000;
const at = (ms) => new Date(Date.now() + ms).toISOString();

async function makeUser(label) {
  const email = `${label}-${run}@takeover-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, email, client };
}

async function insert(table, row) {
  const { data, error } = await service.from(table).insert(row).select().single();
  if (error) throw new Error(`fixture insert into ${table} failed: ${error.message}`);
  return data;
}

const reads = async (u, id) => (await u.client.from('menus').select('id').eq('id', id)).data?.length ?? 0;

before(async () => {
  await db.connect();
  for (const label of ['host', 'hostBartender', 'guestBar', 'guestBartender', 'invited', 'stranger']) users[label] = await makeUser(label);
  ids.host = (await insert('bars', { name: `Host bar ${run}` })).id;
  ids.guest = (await insert('bars', { name: `Guest bar ${run}` })).id;
  ids.guestPage = (await insert('profiles', { kind: 'bar', bar_id: ids.guest, handle: `guest${run}`, display_name: `Guest ${run}`, is_public: true })).id;
  await insert('user_bars', { user_id: users.host.id, bar_id: ids.host, role_level: 40 });
  await insert('user_bars', { user_id: users.hostBartender.id, bar_id: ids.host, role_level: 30 });
  await insert('user_bars', { user_id: users.guestBar.id, bar_id: ids.guest, role_level: 30 });
  ids.guestRole = (await insert('venue_roles', { bar_id: ids.host, name: `Guest bartenders ${run}`, base_level: 30, ends_at: at(3 * DAY) })).id;
  await insert('user_bars', { user_id: users.guestBartender.id, bar_id: ids.host, role_level: 30, venue_role_id: ids.guestRole });
  ids.drink = (await insert('items', { name: `Guest sour ${run}`, item_type: 'cocktail', bar_id: ids.host })).id;
  ids.house = (await insert('menus', { bar_id: ids.host, name: `House ${run}`, created_by: users.host.id })).id;
  ids.takeover = (await insert('menus', { bar_id: ids.host, name: `Takeover ${run}`, created_by: users.host.id, list_type: 'takeover', change_role_id: ids.guestRole, starts_at: at(DAY), ends_at: at(2 * DAY) })).id;
  ids.section = (await insert('menu_sections', { menu_id: ids.takeover, name: 'Guest drinks', sort_order: 0, min_items: 0 })).id;
  ids.party = (await insert('menu_run_parties', { menu_id: ids.takeover, kind: 'guest', name: `Guest ${run}`, profile_id: ids.guestPage })).id;
});

after(async () => {
  for (const id of [ids.takeover, ids.house, ids.old]) if (id) await service.from('menus').delete().eq('id', id);
  if (ids.drink) await service.from('items').delete().eq('id', ids.drink);
  if (ids.guestPage) await service.from('profiles').delete().eq('id', ids.guestPage);
  for (const id of [ids.host, ids.guest]) if (id) await service.from('bars').delete().eq('id', id);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
  await db.end();
});

describe('one page both bars share', () => {
  test("the guest bar's team and the guest bartenders read the takeover list, not the house's drafts", async () => {
    assert.equal(await reads(users.guestBar, ids.takeover), 1, 'the guest bar');
    assert.equal(await reads(users.guestBartender, ids.takeover), 1, 'a guest bartender');
    assert.equal(await reads(users.guestBar, ids.house), 0, "not the host's other lists");
    assert.equal(await reads(users.guestBartender, ids.house), 0, 'nor its drafts');
    assert.equal(await reads(users.stranger, ids.takeover), 0);
    const parties = await users.guestBar.client.from('menu_run_parties').select('id').eq('menu_id', ids.takeover);
    assert.equal(parties.data.length, 1, 'and its run sheet');
  });

  test('a guest bartender changes the takeover list directly, without the menus permission', async () => {
    const may = await users.guestBartender.client.rpc('may_change_list', { p_menu_id: ids.takeover });
    assert.equal(may.data, true);
    const add = await users.guestBartender.client.from('menu_drinks').insert({ menu_id: ids.takeover, menu_section_id: ids.section, item_id: ids.drink, sort_order: 0 }).select('id, waiting').single();
    assert.ifError(add.error);
    assert.equal(add.data.waiting, null);
    const house = await users.guestBartender.client.from('menus').update({ name: 'Mine now' }).eq('id', ids.house).select('id');
    assert.equal(house.data?.length ?? 0, 0, 'not the house list');
    const guestBar = await users.guestBar.client.from('menus').update({ name: 'Ours now' }).eq('id', ids.takeover).select('id');
    assert.equal(guestBar.data?.length ?? 0, 0, "the guest bar's team reads; its guest bartenders edit");
  });

  test('when the role ends, so does the access', async () => {
    await db.query("UPDATE public.venue_roles SET ends_at = now() - interval '1 minute' WHERE id = $1", [ids.guestRole]);
    assert.equal(await reads(users.guestBartender, ids.takeover), 0);
    const add = await users.guestBartender.client.from('menu_sections').insert({ menu_id: ids.takeover, name: 'Late', sort_order: 1 });
    assert.ok(add.error, 'no more changes');
    await db.query("UPDATE public.venue_roles SET ends_at = now() + interval '3 days' WHERE id = $1", [ids.guestRole]);
  });

  test("a takeover's guest role must end and can't be an Admin's; its nights are takeover events", async () => {
    const forever = await insert('venue_roles', { bar_id: ids.host, name: `Forever ${run}`, base_level: 30 });
    const bad = await service.from('menus').update({ change_role_id: forever.id }).eq('id', ids.takeover);
    assert.ok(bad.error, 'a role with no end');
    const night = await service.from('events').insert({ bar_id: ids.host, name: `Night ${run}`, starts_at: at(DAY), menu_id: ids.takeover, kind: 'tasting' });
    assert.ok(night.error, 'a tasting is not a takeover night');
    const ok = await service.from('events').insert({ bar_id: ids.host, name: `Night ${run}`, starts_at: at(DAY), menu_id: ids.takeover, kind: 'takeover' }).select('id').single();
    assert.ifError(ok.error);
    await service.from('events').delete().eq('id', ok.data.id);
    await service.from('venue_roles').delete().eq('id', forever.id);
  });
});

describe('invites onto a role', () => {
  test('a new person joins on the guest role; an existing member keeps theirs', async () => {
    const inv = await users.host.client.rpc('invite_to_role', { p_email: users.invited.email, p_role_id: ids.guestRole, p_name: 'Sam' });
    assert.ifError(inv.error);
    const accept = await users.invited.client.rpc('accept_bar_invite', { p_bar_id: ids.host });
    assert.ifError(accept.error);
    assert.equal(accept.data.venue_role_id, ids.guestRole);
    assert.equal(await reads(users.invited, ids.takeover), 1);

    const member = await users.host.client.rpc('invite_to_role', { p_email: users.hostBartender.email, p_role_id: ids.guestRole });
    assert.ok(member.error, "they're already on the team");
    const outsider = await users.stranger.client.rpc('invite_to_role', { p_email: `x-${run}@takeover-test.local`, p_role_id: ids.guestRole });
    assert.ok(outsider.error, 'only staff invite');
  });
});

describe('a run-sheet link for each party', () => {
  test('saved by an editor, read signed out by token, gone when ended or too old', async () => {
    const list = { drinks: [{ name: 'Guest sour', serves: 120 }], buy: [{ name: 'Lemons', count: 40 }], margin_pct: 10 };
    const saved = await users.guestBartender.client.rpc('save_run_sheet_link', { p_party_id: ids.party, p_list: list });
    assert.ifError(saved.error);
    const token = saved.data;
    const read = await anon.rpc('run_sheet_link', { p_token: token });
    assert.ifError(read.error);
    assert.deepEqual(read.data.list, list);
    assert.equal(read.data.party_name, `Guest ${run}`);
    const wrong = await anon.rpc('run_sheet_link', { p_token: randomUUID() });
    assert.equal(wrong.data, null);
    const stranger = await users.stranger.client.rpc('save_run_sheet_link', { p_party_id: ids.party, p_list: { x: 1 } });
    assert.ok(stranger.error);
    const direct = await users.host.client.schema('private').from('run_sheet_links').select('token');
    assert.ok(direct.error || direct.data.length === 0, 'nobody reads the table directly');

    await db.query("UPDATE public.menus SET starts_at = now() - interval '30 days', ends_at = now() - interval '20 days' WHERE id = $1", [ids.takeover]);
    assert.equal((await anon.rpc('run_sheet_link', { p_token: token })).data, null, '14 days after it ended');
    await db.query("UPDATE public.menus SET starts_at = now() + interval '1 day', ends_at = now() + interval '2 days' WHERE id = $1", [ids.takeover]);

    assert.ifError((await users.host.client.rpc('end_run_sheet_link', { p_party_id: ids.party })).error);
    assert.equal((await anon.rpc('run_sheet_link', { p_token: token })).data, null, 'ended');
  });

  test("the margin has one home on the list", async () => {
    const { data } = await users.host.client.from('menus').update({ run_margin_pct: 15 }).eq('id', ids.takeover).select('run_margin_pct');
    assert.equal(data[0].run_margin_pct, 15);
    const bad = await users.host.client.from('menus').update({ run_margin_pct: 500 }).eq('id', ids.takeover);
    assert.ok(bad.error);
  });
});
