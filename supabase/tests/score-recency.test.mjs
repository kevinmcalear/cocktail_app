// Score recency, a new spec's new score, the bar score, what guests say and
// the want swipe (supabase/migrations/20261206210000_score_recency.sql,
// 20261206220000_want_passes.sql). Local stack only: `npm run test:security`.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const status = JSON.parse(execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run score recency tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const users = {};
const ids = {};
const made = [];
const OLD = 20; // ranked the first spec, over 180 days ago
const NEW = 4; // ranked the new spec

async function makeUser(label, signIn = false) {
  const email = `${label}-${run}@security-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const user = { id: data.user.id };
  made.push(user);
  if (signIn) {
    user.client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
    const { error: signInError } = await user.client.auth.signInWithPassword({ email, password: PASSWORD });
    if (signInError) throw signInError;
  }
  return user;
}

async function serviceInsert(table, row) {
  const { data, error } = await service.from(table).insert(row).select().single();
  if (error) throw new Error(`fixture insert into ${table} failed: ${error.message}`);
  return data;
}

const confirmAge = (userId) => db.query("INSERT INTO private.age_checks (user_id, country_code, minimum_age, confirmed_at) VALUES ($1, 'US', 21, now())", [userId]);
const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);

const rank = (userId, itemId, rankedAs, venue, { sentiment = 'loved', days = 1, reasons = [], room = [] } = {}) =>
  db.query(
    "INSERT INTO public.rank_entries (user_id, item_id, ranked_as_item_id, venue_profile_id, sentiment, rank_key, had_on, created_at, reasons, room_reasons) VALUES ($1, $2, $3, $4, $5, 0, $6, $6::date + time '21:00', $7, $8)",
    [userId, itemId, rankedAs, venue, sentiment, daysAgo(days), reasons, room]
  );

async function rpc(client, fn, args) {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  return data;
}

before(async () => {
  await db.connect();
  const people = [];
  for (let i = 0; i < OLD + NEW; i++) people.push(await makeUser(`scorer${i}`));
  users.creator = await makeUser('creator', true);
  users.admin = await makeUser('admin', true);
  users.bartender = await makeUser('bartender', true);
  users.stranger = await makeUser('stranger', true);
  for (const u of [...people, users.bartender, users.stranger]) await confirmAge(u.id);

  const bar = async (name, handle) => {
    const b = await serviceInsert('bars', { name: `${name} ${run}`, default_publish_mode: 'description' });
    const p = await serviceInsert('profiles', { kind: 'bar', handle: `${handle}${run}`, display_name: `${name} ${run}`, bar_id: b.id, is_public: true, city: `Scoreville ${run}`, postcode: `S${run}`, country_code: 'US' });
    return { bar: b.id, profile: p.id };
  };
  ids.home = await bar('Score Bar', 'scorebar');
  ids.hidden = await bar('Hidden Score Bar', 'hiddenscore');
  await db.query("UPDATE public.bars SET page_visibility = 'private' WHERE id = $1", [ids.hidden.bar]);
  await db.query('INSERT INTO public.user_bars (user_id, bar_id, role_level) VALUES ($1, $3, 35), ($2, $3, 40), ($4, $3, 30)', [users.creator.id, users.admin.id, ids.home.bar, users.bartender.id]);

  const item = async (row) => (await serviceInsert('items', { item_type: 'cocktail', ...row })).id;
  ids.classic = await item({ name: `Score Classic ${run}`, is_catalog: true });
  ids.drink = await item({ name: `Score Riff ${run}`, bar_id: ids.home.bar, riff_of_id: ids.classic, origin: 'Classic' });
  ids.few = await item({ name: `Score Few ${run}`, bar_id: ids.home.bar, origin: 'Original' });
  ids.own = await item({ name: `Score Own ${run}`, bar_id: ids.home.bar, origin: 'Original' });
  ids.hiddenDrink = await item({ name: `Hidden Score Riff ${run}`, bar_id: ids.hidden.bar, riff_of_id: ids.classic, origin: 'Classic' });

  // The riff's spec changed ten days ago.
  await db.query("INSERT INTO public.item_versions (item_id, version, snapshot, created_at) VALUES ($1, 1, '{}', now() - interval '400 days'), ($1, 2, '{}', now() - interval '10 days')", [ids.drink]);

  // The creator is credited with the riff.
  const page = await serviceInsert('profiles', { kind: 'person', user_id: users.creator.id, handle: `scorecreator${run}`, display_name: `Score Creator ${run}` });
  await db.query("INSERT INTO public.item_credits (item_id, role, profile_id, status) VALUES ($1, 'creator', $2, 'accepted')", [ids.drink, page.id]);

  // OLD people liked the first spec well enough, long ago; NEW people loved the new one.
  for (const [n, u] of people.entries()) {
    const isNew = n >= OLD;
    await rank(u.id, ids.drink, ids.classic, ids.home.profile, {
      sentiment: isNew ? 'loved' : 'fine',
      days: isNew ? 2 : 200,
      reasons: isNew ? ['order_again'] : ['too_sweet'],
      room: n < 21 ? ['great_room'] : [],
    });
    await rank(u.id, ids.own, ids.own, ids.home.profile, { days: 30 });
    if (n < 5) await rank(u.id, ids.few, ids.few, ids.home.profile, { days: 20 });
    await rank(u.id, ids.hiddenDrink, ids.classic, ids.hidden.profile, { days: 20 });
  }
  // Staff at their own bar don't count.
  await rank(users.bartender.id, ids.drink, ids.classic, ids.home.profile);

  await db.query("INSERT INTO public.item_flavors (item_id, sweet, sour, bitter, strong, herbal, fruity, smoky, spicy, creamy, coverage, source, spec_fingerprint, rules_version) VALUES ($1, 0.2, 0.3, 0.8, 0.7, 0.4, 0.1, 0, 0, 0, 1, 'rules', $2, 0)", [ids.classic, `test-${run}`]);
  await db.query('SELECT private.refresh_rankings()');
});

after(async () => {
  const like = `%${run}%`;
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.profiles WHERE handle LIKE $1', [like]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  for (const user of made) await service.auth.admin.deleteUser(user.id);
  await db.query('SELECT private.refresh_rankings()');
  await db.end();
});

describe('the rules', () => {
  test('a rank counts in full for 180 days, then half', async () => {
    const { rows } = await db.query('SELECT private.score_weight(current_date - 180) AS full, private.score_weight(current_date - 181) AS half');
    assert.deepEqual(rows[0], { full: '1.0', half: '0.5' });
  });

  test('the floors', async () => {
    const { rows } = await db.query("SELECT private.score_floor('people') AS people, private.score_floor('bar_ranks') AS bar, private.score_floor('list_bars') AS list, private.score_floor('reasons') AS reasons, private.score_floor('room') AS room");
    assert.deepEqual(rows[0], { people: 20, bar: 50, list: 5, reasons: 20, room: 20 });
  });

  test('nobody calls the helpers directly', async () => {
    const { error } = await users.stranger.client.schema('private').rpc('score_floor', { p_name: 'people' });
    assert.ok(error);
  });
});

describe('get_drink_score', () => {
  test('a new spec has its own score, with the one before linked', async () => {
    const s = await rpc(anon, 'get_drink_score', { p_item_id: ids.drink });
    assert.equal(s.rankers, OLD + NEW, 'every spec counts towards the floor, staff left out');
    assert.equal(s.current_rankers, NEW);
    assert.equal(s.version, 2);
    assert.equal(s.recent, NEW);
    assert.equal(s.older, OLD);
    assert.equal(s.previous.version, 1);
    assert.equal(s.previous.rankers, OLD);
    assert.ok(s.score > s.previous.score, `the new spec's loves lift it: ${s.score} after ${s.previous.score}`);
    assert.ok(Array.isArray(s.history));
    assert.equal(s.city_list.bars, 1);
    assert.equal(s.city_list.position, 1);
    assert.equal(s.list_floor, 5);
  });

  test('below the floor: people so far, no score', async () => {
    const s = await rpc(anon, 'get_drink_score', { p_item_id: ids.few });
    assert.equal(s.rankers, 5);
    assert.equal(s.score, null);
    assert.equal(s.previous, null);
    assert.deepEqual(s.history, []);
  });

  test('a private bar page has no public score', async () => {
    assert.equal(await rpc(anon, 'get_drink_score', { p_item_id: ids.hiddenDrink }), null);
  });
});

describe('get_bar_score', () => {
  test('the bar score shows once 50 ranks are in, with its best drinks', async () => {
    const s = await rpc(anon, 'get_bar_score', { p_profile_id: ids.home.profile });
    assert.equal(s.ranks, 2 * (OLD + NEW) + 5);
    assert.equal(s.rankers, OLD + NEW);
    assert.equal(s.drinks, 2, 'only drinks past the people floor are scored');
    assert.ok(s.score > 0);
    assert.equal(s.best.length, 2);
    assert.ok(s.best.every((d) => d.rankers >= 20));
  });

  test('a private bar page has none', async () => {
    assert.equal(await rpc(anon, 'get_bar_score', { p_profile_id: ids.hidden.profile }), null);
  });
});

describe('what guests say', () => {
  test('a drink: Drink Creators only', async () => {
    await assert.rejects(rpc(anon, 'get_drink_guest_says', { p_item_id: ids.drink }));
    for (const who of [users.stranger, users.bartender]) {
      await assert.rejects(rpc(who.client, 'get_drink_guest_says', { p_item_id: ids.drink }), (e) => e.code === '42501');
    }
    const says = await rpc(users.creator.client, 'get_drink_guest_says', { p_item_id: ids.drink });
    const [now, before] = says.versions;
    assert.equal(now.version, 2);
    assert.equal(now.rankers, NEW);
    assert.equal(now.liked, null, 'a version under 20 people shows no breakdown');
    assert.equal(now.reasons, null);
    assert.equal(before.version, 1);
    assert.equal(before.rankers, OLD);
    assert.deepEqual([before.liked, before.fine, before.not_for_me], [0, OLD, 0]);
    assert.deepEqual(before.reasons, { too_sweet: OLD });
    assert.ok(!JSON.stringify(says).includes(made[0].id), 'never who said it');
  });

  test('your drinks: only your own credits', async () => {
    const mine = await rpc(users.creator.client, 'get_my_drinks_guest_says', {});
    assert.deepEqual(mine.map((r) => [r.item_id, r.rankers, r.liked]), [[ids.drink, NEW, null]]);
    assert.deepEqual(await rpc(users.stranger.client, 'get_my_drinks_guest_says', {}), []);
    await assert.rejects(rpc(anon, 'get_my_drinks_guest_says', {}));
  });

  test('the room: Admins only, totals once 20 said something', async () => {
    for (const who of [users.creator, users.bartender, users.stranger]) {
      await assert.rejects(rpc(who.client, 'get_bar_guest_says', { p_bar_id: ids.home.bar }), (e) => e.code === '42501');
    }
    await assert.rejects(rpc(anon, 'get_bar_guest_says', { p_bar_id: ids.home.bar }));
    const room = await rpc(users.admin.client, 'get_bar_guest_says', { p_bar_id: ids.home.bar });
    assert.equal(room.people, OLD + NEW, 'people in the last 90 days, staff left out');
    assert.equal(room.room_people, 1, 'the old room words are past 90 days');
    assert.equal(room.room, null);
  });
});

describe('the want swipe', () => {
  test('a pass is private to its person', async () => {
    const { error } = await users.stranger.client.from('drink_passes').insert({ item_id: ids.classic });
    assert.equal(error, null);
    const { error: forOther } = await users.stranger.client.from('drink_passes').insert({ item_id: ids.drink, user_id: users.creator.id });
    assert.ok(forOther, 'cannot pass for someone else');
    const { data: seen } = await users.creator.client.from('drink_passes').select('item_id');
    assert.deepEqual(seen, []);
    const { data: anonSeen, error: anonError } = await anon.from('drink_passes').select('item_id');
    assert.ok(anonError || anonSeen.length === 0);
  });

  test('the deck skips what you passed on, and needs a sign-in', async () => {
    const deck = (who) => rpc(who.client, 'want_deck', { p_limit: 50 });
    assert.ok((await deck(users.creator)).some((d) => d.item_id === ids.classic));
    assert.ok(!(await deck(users.stranger)).some((d) => d.item_id === ids.classic));
    await assert.rejects(rpc(anon, 'want_deck', { p_limit: 5 }));
  });
});
