// Behind the bar (20261016500000_event_staff): who works an event. The host
// bar's team reads and (with the menus permission) edits the list; everyone
// else reads it through week_event_staff, for events they can open, and sees
// a person's name only when that person's own choices allow it: a teammate
// whose public profile shows their job at the bar, a guest by the typed name
// unless the venue linked a profile that isn't public. Nobody else is named.
//
//   supabase start && supabase db reset
//   npm run test:security
//
// Every fixture is named with a per-run id and removed afterwards.

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
  throw new Error(`Refusing to run event staff tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const ids = {};
const users = {};
const at = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

async function serviceInsert(table, row) {
  const { data, error } = await service.from(table).insert(row).select().single();
  if (error) throw new Error(`fixture insert into ${table} failed: ${error.message}`);
  return data;
}

async function makeUser(label, fullName) {
  const email = `${label}-${run}@security-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: fullName ?? `${label} ${run}` } });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const signIn = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signIn.error) throw signIn.error;
  return { id: data.user.id, client };
}

const person = (handle, extra = {}) => serviceInsert('profiles', { kind: 'person', handle: `${handle}.${run}`, display_name: `${handle} ${run}`, is_public: true, ...extra });

/** week_event_staff for one event, as a client reads it. */
async function staff(client, eventId) {
  const { data, error } = await client.rpc('week_event_staff', { p_event_ids: [eventId] });
  assert.ifError(error);
  return data;
}
const byId = (rows, id) => rows.find((r) => r.id === id);

before(async () => {
  await db.connect();
  for (const label of ['maker', 'floor', 'shown', 'past', 'quiet', 'private', 'outsider', 'guest', 'otherMaker']) users[label] = await makeUser(label);

  ids.bar = (await serviceInsert('bars', { name: `Staffbar ${run}` })).id;
  ids.otherBar = (await serviceInsert('bars', { name: `Otherstaff ${run}` })).id;
  ids.hiddenBar = (await serviceInsert('bars', { name: `Hiddenstaff ${run}` })).id;
  ids.barPage = (await serviceInsert('profiles', { kind: 'bar', handle: `staffbar.${run}`, display_name: `Staffbar ${run}`, is_public: true, bar_id: ids.bar })).id;
  await serviceInsert('profiles', { kind: 'bar', handle: `hiddenstaff.${run}`, display_name: `Hiddenstaff ${run}`, is_public: false, bar_id: ids.hiddenBar });
  ids.guestBar = (await serviceInsert('profiles', { kind: 'bar', handle: `palemoth.${run}`, display_name: `Pale Moth ${run}`, is_public: true })).id;

  await serviceInsert('user_bars', { user_id: users.maker.id, bar_id: ids.bar, role_level: 35 });
  await serviceInsert('user_bars', { user_id: users.floor.id, bar_id: ids.bar, role_level: 20 });
  for (const label of ['shown', 'past', 'quiet', 'private']) await serviceInsert('user_bars', { user_id: users[label].id, bar_id: ids.bar, role_level: 20 });
  await serviceInsert('user_bars', { user_id: users.otherMaker.id, bar_id: ids.otherBar, role_level: 35 });
  await serviceInsert('user_bars', { user_id: users.maker.id, bar_id: ids.hiddenBar, role_level: 35 });

  // shown: public profile, current job here. past: public, a past job here
  // they haven't switched on. quiet: public, no job here. private: a job here
  // on a profile that isn't public.
  ids.shownProfile = (await person('sam', { user_id: users.shown.id })).id;
  ids.pastProfile = (await person('pat', { user_id: users.past.id })).id;
  await person('quinn', { user_id: users.quiet.id });
  ids.privateProfile = (await person('priv', { user_id: users.private.id, is_public: false })).id;
  await serviceInsert('profile_positions', { person_profile_id: ids.shownProfile, bar_profile_id: ids.barPage, title: 'Bartender' });
  ids.pastJob = (await serviceInsert('profile_positions', { person_profile_id: ids.pastProfile, bar_profile_id: ids.barPage, title: 'Bartender', is_current: false })).id;
  await serviceInsert('profile_positions', { person_profile_id: ids.privateProfile, bar_profile_id: ids.barPage, title: 'Bartender' });

  ids.guestPublic = (await person('jun')).id;
  ids.guestHidden = (await person('hid', { is_public: false })).id;

  const event = (bar_id, name, extra = {}) => serviceInsert('events', { bar_id, name: `${name} ${run}`, starts_at: at(1), ...extra });
  ids.publicEvent = (await event(ids.bar, 'Takeover', { kind: 'takeover', is_public: true, guest_profile_id: ids.guestBar })).id;
  ids.teamEvent = (await event(ids.bar, 'Staff tasting', { kind: 'tasting' })).id;
  ids.hiddenBarEvent = (await event(ids.hiddenBar, 'Hidden takeover', { kind: 'takeover', is_public: true })).id;

  const row = (event_id, extra) => serviceInsert('event_staff', { event_id, ...extra });
  ids.rowShown = (await row(ids.publicEvent, { user_id: users.shown.id, sort_order: 1 })).id;
  ids.rowPast = (await row(ids.publicEvent, { user_id: users.past.id, sort_order: 2 })).id;
  ids.rowQuiet = (await row(ids.publicEvent, { user_id: users.quiet.id, sort_order: 3 })).id;
  ids.rowPrivate = (await row(ids.publicEvent, { user_id: users.private.id, sort_order: 4 })).id;
  ids.rowTyped = (await row(ids.publicEvent, { guest_name: 'Mara Q.', sort_order: 5 })).id;
  ids.rowLinked = (await row(ids.publicEvent, { guest_name: 'Jun A.', profile_id: ids.guestPublic, sort_order: 6 })).id;
  ids.rowLinkedHidden = (await row(ids.publicEvent, { guest_name: 'Hidden H.', profile_id: ids.guestHidden, sort_order: 7 })).id;
  await row(ids.teamEvent, { user_id: users.shown.id });
  await row(ids.hiddenBarEvent, { guest_name: 'Nobody N.' });
});

after(async () => {
  const like = `%${run}%`;
  await db.query('DELETE FROM public.user_blocks WHERE blocker_id = ANY($1)', [Object.values(users).map((u) => u.id)]);
  await db.query('DELETE FROM public.events WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.profiles WHERE handle LIKE $1', [like]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
  await db.end();
});

describe('reading behind the bar', () => {
  test('the team reads everyone by name, with accounts and links', async () => {
    const rows = await staff(users.floor.client, ids.publicEvent);
    assert.equal(rows.length, 7);
    assert.equal(byId(rows, ids.rowQuiet).name, `quiet ${run}`);
    assert.equal(byId(rows, ids.rowPrivate).name, `private ${run}`);
    assert.equal(byId(rows, ids.rowPrivate).user_id, users.private.id);
    assert.equal(byId(rows, ids.rowLinkedHidden).name, 'Hidden H.');
    assert.equal(byId(rows, ids.rowLinkedHidden).profile_id, ids.guestHidden);
    assert.deepEqual(rows.map((r) => r.id), [ids.rowShown, ids.rowPast, ids.rowQuiet, ids.rowPrivate, ids.rowTyped, ids.rowLinked, ids.rowLinkedHidden]);
    const direct = await users.floor.client.from('event_staff').select('id').eq('event_id', ids.publicEvent);
    assert.ifError(direct.error);
    assert.equal(direct.data.length, 7);
  });

  for (const who of ['anon', 'guest']) {
    test(`${who === 'anon' ? 'signed out' : 'a signed-in guest'}: names only where the person allows it`, async () => {
      const client = who === 'anon' ? anon : users.guest.client;
      const rows = await staff(client, ids.publicEvent);
      assert.equal(rows.length, 7, 'everyone is counted');
      const shown = byId(rows, ids.rowShown);
      assert.equal(shown.name, `sam ${run}`);
      assert.equal(shown.profile_id, ids.shownProfile);
      assert.equal(shown.profile_handle, `sam.${run}`);
      for (const id of [ids.rowPast, ids.rowQuiet, ids.rowPrivate]) {
        const r = byId(rows, id);
        assert.equal(r.name, null, `${id} is not named`);
        assert.equal(r.profile_id, null);
        assert.equal(r.is_guest, false);
      }
      assert.equal(byId(rows, ids.rowTyped).name, 'Mara Q.');
      assert.equal(byId(rows, ids.rowTyped).is_guest, true);
      assert.equal(byId(rows, ids.rowLinked).name, 'Jun A.');
      assert.equal(byId(rows, ids.rowLinked).profile_id, ids.guestPublic);
      assert.equal(byId(rows, ids.rowLinkedHidden).name, null, "a linked profile that isn't public hides the name");
      assert.equal(byId(rows, ids.rowLinkedHidden).profile_id, null);
      assert.ok(rows.every((r) => r.user_id === null), 'no accounts for guests');
    });
  }

  test('a past job shows the name once the person switches it on', async () => {
    await db.query('UPDATE public.profile_positions SET is_shown = true WHERE id = $1', [ids.pastJob]);
    assert.equal(byId(await staff(anon, ids.publicEvent), ids.rowPast).name, `pat ${run}`);
    await db.query('UPDATE public.profile_positions SET is_hidden = true WHERE id = $1', [ids.pastJob]);
    assert.equal(byId(await staff(anon, ids.publicEvent), ids.rowPast).name, null, 'hidden again');
  });

  test('blocking hides the name from the person who blocked', async () => {
    assert.ifError((await users.guest.client.from('user_blocks').insert({ blocked_id: users.shown.id })).error);
    assert.equal(byId(await staff(users.guest.client, ids.publicEvent), ids.rowShown).name, null);
    assert.equal(byId(await staff(anon, ids.publicEvent), ids.rowShown).name, `sam ${run}`);
  });

  test('team-only events and bars without a public page show guests nobody', async () => {
    for (const client of [anon, users.guest.client, users.otherMaker.client]) {
      assert.equal((await staff(client, ids.teamEvent)).length, 0);
      assert.equal((await staff(client, ids.hiddenBarEvent)).length, 0);
    }
    assert.equal((await staff(users.floor.client, ids.teamEvent)).length, 1, 'the team still sees it');
  });

  test('the table itself stays closed to everyone off the team', async () => {
    const signedOut = await anon.from('event_staff').select('id').eq('event_id', ids.publicEvent);
    assert.deepEqual(signedOut.data ?? [], []);
    for (const label of ['guest', 'otherMaker']) {
      const { data } = await users[label].client.from('event_staff').select('id').eq('event_id', ids.publicEvent);
      assert.deepEqual(data ?? [], []);
    }
  });
});

describe('writing behind the bar', () => {
  test('whoever manages events adds a teammate and a guest; the floor cannot', async () => {
    const add = await users.maker.client
      .from('event_staff')
      .insert([
        { event_id: ids.teamEvent, user_id: users.floor.id },
        { event_id: ids.teamEvent, guest_name: 'Jun A.', profile_id: ids.guestPublic },
      ])
      .select('id');
    assert.ifError(add.error);
    assert.equal(add.data.length, 2);
    const floor = await users.floor.client.from('event_staff').insert({ event_id: ids.teamEvent, guest_name: 'Sneaky S.' });
    assert.ok(floor.error);
    const floorDelete = await users.floor.client.from('event_staff').delete().eq('id', add.data[0].id).select('id');
    assert.deepEqual(floorDelete.data ?? [], []);
    const change = await users.maker.client.from('event_staff').update({ sort_order: 9 }).eq('id', add.data[1].id).select('id');
    assert.ifError(change.error);
    assert.equal(change.data.length, 1);
    const remove = await users.maker.client.from('event_staff').delete().eq('id', add.data[1].id).select('id');
    assert.equal(remove.data.length, 1);
  });

  test("guests, signed-out visitors and other bars' teams cannot write", async () => {
    const signedOut = await anon.from('event_staff').insert({ event_id: ids.publicEvent, guest_name: 'Anon A.' });
    assert.ok(signedOut.error);
    const guest = await users.guest.client.from('event_staff').insert({ event_id: ids.publicEvent, guest_name: 'Guest G.' });
    assert.ok(guest.error);
    const other = await users.otherMaker.client.from('event_staff').insert({ event_id: ids.publicEvent, guest_name: 'Other O.' });
    assert.ok(other.error);
    const otherDelete = await users.otherMaker.client.from('event_staff').delete().eq('id', ids.rowTyped).select('id');
    assert.deepEqual(otherDelete.data ?? [], []);
  });

  test("someone off the team can't be added by account, only by name", async () => {
    const outsider = await users.maker.client.from('event_staff').insert({ event_id: ids.teamEvent, user_id: users.outsider.id });
    assert.equal(outsider.error?.code, '42501');
    const otherTeam = await users.maker.client.from('event_staff').insert({ event_id: ids.teamEvent, user_id: users.otherMaker.id });
    assert.equal(otherTeam.error?.code, '42501');
  });

  test('a row is a teammate or a named guest, and a link is to a person', async () => {
    const both = await users.maker.client.from('event_staff').insert({ event_id: ids.teamEvent, user_id: users.floor.id, guest_name: 'Both B.' });
    assert.ok(both.error);
    const neither = await users.maker.client.from('event_staff').insert({ event_id: ids.teamEvent });
    assert.equal(neither.error?.code, '23514');
    const barLink = await users.maker.client.from('event_staff').insert({ event_id: ids.teamEvent, guest_name: 'Bar B.', profile_id: ids.guestBar });
    assert.ok(barLink.error);
    const memberLink = await users.maker.client.from('event_staff').insert({ event_id: ids.teamEvent, user_id: users.quiet.id, profile_id: ids.guestPublic });
    assert.equal(memberLink.error?.code, '23514');
  });

  test('guest names go through the content filter', async () => {
    const bad = await users.maker.client.from('event_staff').insert({ event_id: ids.teamEvent, guest_name: 'faggot' });
    assert.equal(bad.error?.code, 'P0001');
  });

  test('an event lists up to 20 people', async () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ event_id: ids.hiddenBarEvent, guest_name: `Guest ${i}` }));
    const many = await users.maker.client.from('event_staff').insert(rows.slice(0, 19));
    assert.ifError(many.error);
    const over = await users.maker.client.from('event_staff').insert(rows[19]);
    assert.ok(over.error, 'the 21st is refused');
  });
});
