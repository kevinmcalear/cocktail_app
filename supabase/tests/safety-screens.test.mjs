// Tests for the safety screens' draft migrations: the moderator check, the
// blocked-people list, the report queue, personal drinks following blocks
// and moderation holds on the raw items read (20260930000500), and ranking
// needing a confirmed age (20260930000600).
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
  throw new Error(`Refusing to run safety tests against a non-local API: ${status.API_URL}`);
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

const canReadItem = async (client, id) => {
  const { data, error } = await client.from('items').select('id').eq('id', id);
  assert.ifError(error);
  return data.length === 1;
};

before(async () => {
  await db.connect();
  for (const label of ['jo', 'ash', 'bystander', 'moderator', 'loner', 'ranker', 'minor', 'earlyRanker']) users[label] = await makeUser(label);
  await db.query('INSERT INTO private.app_admins (user_id) VALUES ($1)', [users.moderator.id]);

  ids.bar = (await serviceInsert('bars', { name: `Night Owl ${run}` })).id;
  ids.barProfile = (
    await serviceInsert('profiles', { kind: 'bar', handle: `owl${run}`, display_name: `Night Owl ${run}`, bar_id: ids.bar, is_public: true })
  ).id;
  ids.joProfile = (
    await serviceInsert('profiles', { kind: 'person', handle: `jo${run}`, display_name: 'Jo', user_id: users.jo.id, is_public: true })
  ).id;
  ids.ashProfile = (
    await serviceInsert('profiles', { kind: 'person', handle: `ash${run}`, display_name: 'Ash', user_id: users.ash.id, is_public: true })
  ).id;
  // The loner's profile is private.
  await serviceInsert('profiles', { kind: 'person', handle: `lo${run}`, display_name: 'Lo', user_id: users.loner.id, is_public: false });

  ids.joRiff = (
    await serviceInsert('items', { name: `Jo Riff ${run}`, item_type: 'cocktail', created_by: users.jo.id, publish_mode: 'description' })
  ).id;
  ids.joDraft = (await serviceInsert('items', { name: `Jo Draft ${run}`, item_type: 'cocktail', created_by: users.jo.id })).id;
  ids.barDrink = (
    await serviceInsert('items', { name: `Owl Sour ${run}`, item_type: 'cocktail', bar_id: ids.bar, publish_mode: 'description' })
  ).id;
  ids.list = (await serviceInsert('items', { name: `Sour ${run}`, item_type: 'cocktail', created_by: null })).id;
});

after(async () => {
  const like = `%${run}%`;
  await db.query('DELETE FROM public.reports WHERE reporter_id = ANY($1)', [Object.values(users).map((u) => u.id)]);
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.profiles WHERE handle LIKE $1', [like]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('am_i_moderator', () => {
  test('true for catalog admins only, and not for signed-out callers', async () => {
    assert.equal((await users.moderator.client.rpc('am_i_moderator')).data, true);
    assert.equal((await users.jo.client.rpc('am_i_moderator')).data, false);
    assert.ok((await anon.rpc('am_i_moderator')).error);
  });
});

describe('personal drinks on the raw items read', () => {
  test('a published riff is readable by others; a draft only by its maker', async () => {
    assert.ok(await canReadItem(users.bystander.client, ids.joRiff));
    assert.ok(!(await canReadItem(users.bystander.client, ids.joDraft)));
    assert.ok(await canReadItem(users.jo.client, ids.joDraft));
  });

  test('a block hides each person\'s drinks from the other, not from bystanders', async () => {
    assert.ifError((await users.ash.client.from('user_blocks').insert({ blocked_id: users.jo.id })).error);
    assert.ok(!(await canReadItem(users.ash.client, ids.joRiff)));
    assert.ok(await canReadItem(users.bystander.client, ids.joRiff));
    assert.ok(await canReadItem(users.jo.client, ids.joRiff));
    // A bar's drinks aren't one person's content.
    assert.ok(await canReadItem(users.ash.client, ids.list));
  });

  test('a moderation hold hides the drink from everyone but its maker and moderators', async () => {
    assert.ifError((await users.moderator.client.rpc('set_content_hidden', { p_kind: 'item', p_id: ids.joRiff, p_hidden: true })).error);
    assert.ok(!(await canReadItem(users.bystander.client, ids.joRiff)));
    assert.ok(await canReadItem(users.jo.client, ids.joRiff));
    assert.ok(await canReadItem(users.moderator.client, ids.joRiff));
    assert.ifError((await users.moderator.client.rpc('set_content_hidden', { p_kind: 'item', p_id: ids.joRiff, p_hidden: false })).error);
    assert.ok(await canReadItem(users.bystander.client, ids.joRiff));
  });

  test('hiding the maker\'s profile hides their drinks too', async () => {
    assert.ifError((await users.moderator.client.rpc('set_content_hidden', { p_kind: 'profile', p_id: ids.joProfile, p_hidden: true })).error);
    assert.ok(!(await canReadItem(users.bystander.client, ids.joRiff)));
    assert.ifError((await users.moderator.client.rpc('set_content_hidden', { p_kind: 'profile', p_id: ids.joProfile, p_hidden: false })).error);
    assert.ok(await canReadItem(users.bystander.client, ids.joRiff));
  });
});

describe('get_my_blocks', () => {
  test('the blocker sees who they blocked, by name, though the profile itself is hidden', async () => {
    const { data, error } = await users.ash.client.rpc('get_my_blocks');
    assert.ifError(error);
    assert.equal(data.length, 1);
    assert.equal(data[0].blocked_id, users.jo.id);
    assert.equal(data[0].profile_id, ids.joProfile);
    assert.equal(data[0].display_name, 'Jo');
    assert.equal((await users.ash.client.from('profiles').select('id').eq('id', ids.joProfile)).data.length, 0);
  });

  test('the blocked person sees nothing, and a private profile gives no name', async () => {
    assert.deepEqual((await users.jo.client.rpc('get_my_blocks')).data, []);
    assert.ifError((await users.bystander.client.from('user_blocks').insert({ blocked_id: users.loner.id })).error);
    const { data } = await users.bystander.client.rpc('get_my_blocks');
    assert.equal(data.length, 1);
    assert.equal(data[0].blocked_id, users.loner.id);
    assert.equal(data[0].display_name, null);
    assert.equal(data[0].handle, null);
  });

  test('signed-out callers can\'t use it', async () => {
    assert.ok((await anon.rpc('get_my_blocks')).error);
  });
});

describe('get_report_queue', () => {
  test('only moderators read it', async () => {
    assert.ok((await users.jo.client.rpc('get_report_queue')).error);
    assert.ok((await anon.rpc('get_report_queue')).error);
  });

  test('open reports come with what they\'re about, and closed ones move to the other list', async () => {
    const bystander = users.bystander.client;
    for (const row of [
      { target_kind: 'item', item_id: ids.barDrink, reason: 'misleading', details: `Not their recipe ${run}` },
      { target_kind: 'ranking', item_id: ids.list, profile_id: ids.barProfile, reason: 'fake_rankings' },
      { target_kind: 'profile', profile_id: ids.ashProfile, reason: 'impersonation' },
    ]) {
      assert.ifError((await bystander.from('reports').insert(row)).error);
    }

    const { data: open, error } = await users.moderator.client.rpc('get_report_queue', { p_open: true });
    assert.ifError(error);
    const mine = open.filter((r) => [ids.barDrink, ids.list, ids.ashProfile].includes(r.item_id ?? r.profile_id));
    const byKind = Object.fromEntries(mine.map((r) => [r.target_kind, r]));
    assert.equal(byKind.item.target_name, `Owl Sour ${run}`);
    assert.equal(byKind.item.target_detail, `Night Owl ${run}`);
    assert.equal(byKind.item.details, `Not their recipe ${run}`);
    assert.equal(byKind.ranking.target_name, `Sour ${run}`);
    assert.equal(byKind.ranking.target_detail, `Night Owl ${run}`);
    assert.equal(byKind.profile.target_name, 'Ash');
    assert.equal(byKind.profile.target_detail, `@ash${run} · person`);
    assert.ok(mine.every((r) => r.target_hidden === false && r.status === 'open'));
    assert.ok(!('reporter_id' in byKind.item));

    // Resolved with a takedown: the moderator isn't a member of the bar, but
    // the queue still names the hidden drink.
    assert.ifError(
      (await users.moderator.client.rpc('resolve_report', { p_report_id: byKind.item.id, p_status: 'actioned', p_resolution: 'Taken down.', p_hide: true })).error
    );
    const { data: closed } = await users.moderator.client.rpc('get_report_queue', { p_open: false });
    const done = closed.find((r) => r.id === byKind.item.id);
    assert.equal(done.status, 'actioned');
    assert.equal(done.target_hidden, true);
    assert.equal(done.target_name, `Owl Sour ${run}`);
    const { data: stillOpen } = await users.moderator.client.rpc('get_report_queue', { p_open: true });
    assert.ok(!stillOpen.some((r) => r.id === byKind.item.id));
  });
});

describe('ranking needs a confirmed age', () => {
  const rank = (who, venue = null, key = 1) =>
    users[who].client
      .from('rank_entries')
      .insert({ item_id: ids.list, ranked_as_item_id: ids.list, venue_profile_id: venue, sentiment: 'loved', rank_key: key })
      .select('id')
      .single();
  const years = (n) => `${new Date().getFullYear() - n}-01-01`;

  test('no answer yet: refused, then allowed once confirmed', async () => {
    assert.ok((await rank('ranker')).error);
    assert.ifError((await users.ranker.client.rpc('confirm_age', { p_birth_date: years(30), p_country_code: 'AU' })).error);
    const home = await rank('ranker');
    assert.ifError(home.error);
    const bar = await rank('ranker', ids.barProfile, 2);
    assert.ifError(bar.error);
    assert.ifError((await users.ranker.client.from('rank_comparisons').insert({ winner_entry_id: bar.data.id, loser_entry_id: home.data.id })).error);
  });

  test('under age: refused, and stays refused', async () => {
    const { data } = await users.minor.client.rpc('confirm_age', { p_birth_date: years(15), p_country_code: 'AU' });
    assert.equal(data, null);
    assert.ok((await rank('minor')).error);
  });

  test('rankings made before the check can still be read and deleted, not changed', async () => {
    const { rows } = await db.query(
      `INSERT INTO public.rank_entries (user_id, item_id, ranked_as_item_id, venue_profile_id, sentiment, rank_key)
       VALUES ($1, $2, $2, NULL, 'fine', 1), ($1, $2, $2, $3, 'loved', 2) RETURNING id`,
      [users.earlyRanker.id, ids.list, ids.barProfile]
    );
    const early = users.earlyRanker.client;
    const { data: mine } = await early.from('rank_entries').select('id');
    assert.equal(mine.length, 2);
    assert.ok((await early.from('rank_entries').update({ sentiment: 'disliked' }).eq('id', rows[0].id)).error);
    assert.ok((await early.from('rank_comparisons').insert({ winner_entry_id: rows[1].id, loser_entry_id: rows[0].id })).error);
    const { data: deleted } = await early.from('rank_entries').delete().eq('id', rows[0].id).select('id');
    assert.equal(deleted.length, 1);
  });
});
