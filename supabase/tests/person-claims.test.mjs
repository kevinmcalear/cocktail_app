// Person claims: someone finds the page we seeded for them and says "This is
// me" (find yourself, step 4). Claims start through start_person_claim, by an
// Instagram message code or a note, and approval merges the page into the
// claimant's own profile when they have one
// (supabase/migrations/20261030100000_person_claim_merge.sql). Old links to the
// merged page find the claimant through merged_profile_handle (20261103300000).
// Runs against the local stack only: `npm run test:security`.
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
  throw new Error(`Refusing to run person claim tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const users = {};
const ids = {};
const pages = [];
const items = [];

async function makeUser(label) {
  const email = `${label}-${run}@security-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];

async function page(key, kind, fields = {}) {
  const cols = { kind, handle: `${key}${run}`.toLowerCase(), display_name: `${key} ${run}`, is_public: true, ...fields };
  const names = Object.keys(cols);
  const row = await one(
    `INSERT INTO public.profiles (${names.join(', ')}) VALUES (${names.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
    Object.values(cols)
  );
  pages.push(row.id);
  ids[key] = row.id;
  return row.id;
}

async function drink(key, creator) {
  const row = await one(
    "INSERT INTO public.items (name, item_type, creator_profile_id, credit_status) VALUES ($1, 'cocktail', $2, 'suggested') RETURNING id",
    [`${key} ${run}`, creator]
  );
  items.push(row.id);
  ids[key] = row.id;
  return row.id;
}

const claim = (who, pageKey, method = 'note', extra = {}) =>
  users[who].client.rpc('start_person_claim', { p_profile_id: ids[pageKey], p_method: method, ...extra });

const count = async (sql, params) => Number((await one(`SELECT count(*) AS n FROM (${sql}) x`, params)).n);

before(async () => {
  await db.connect();
  for (const label of ['ash', 'fresh', 'rival', 'stranger', 'busy', 'moderator']) users[label] = await makeUser(label);
  await db.query('INSERT INTO private.app_admins (user_id) VALUES ($1)', [users.moderator.id]);

  await page('Moth', 'bar');
  // Ash's own profile, made when they signed up. Their website, but no bio,
  // Instagram or links yet (a bio of spaces counts as blank).
  await page('AshOwn', 'person', { user_id: users.ash.id, display_name: 'Ash', bio: '  ', website: 'https://ash.example.com' });
  // The page we seeded for them, before they joined.
  await page('Ash', 'person', {
    instagram: `ash.okafor${run}`,
    bio: 'Head bartender at Pale Moth.',
    tagline: 'Stirred, mostly.',
    website: 'https://palemoth.example.com/team/ash',
    social_links: ['https://www.tiktok.com/@ashokafor'],
  });
  await page('NoGram', 'person');
  await page('Spare', 'person', { instagram: `spare${run}` });
  await page('Taken', 'person', { user_id: users.stranger.id });
  await page('Hidden', 'person', { moderated_at: new Date().toISOString() });
  for (const n of [1, 2, 3, 4]) await page(`Busy${n}`, 'person');

  // Their drinks: one of their own on the page, one Ash already credits with
  // the page as co-creator, one where both are co-creators.
  await drink('MothMartini', ids.Ash);
  await drink('OwnSour', ids.AshOwn);
  await drink('Shared', null);
  await db.query('INSERT INTO public.item_co_creators (item_id, profile_id) VALUES ($1, $2), ($3, $2), ($3, $4)', [ids.OwnSour, ids.Ash, ids.Shared, ids.AshOwn]);

  // Jobs: the same one on both (the page's has dates and the bar's yes), and one only on the page.
  ids.pageHead = (await one(
    "INSERT INTO public.profile_positions (person_profile_id, bar_profile_id, title, start_year, bar_accepted) VALUES ($1, $2, 'Head bartender', 2021, true) RETURNING id",
    [ids.Ash, ids.Moth]
  )).id;
  ids.ownHead = (await one(
    "INSERT INTO public.profile_positions (person_profile_id, bar_profile_id, title, bar_accepted) VALUES ($1, $2, 'Head bartender', false) RETURNING id",
    [ids.AshOwn, ids.Moth]
  )).id;
  ids.pageJob = (await one(
    "INSERT INTO public.profile_positions (person_profile_id, bar_profile_id, title, is_current, start_year, end_year) VALUES ($1, $2, 'Bartender', false, 2018, 2020) RETURNING id",
    [ids.Ash, ids.Moth]
  )).id;
  await db.query('UPDATE public.profiles SET headline_position_id = $1 WHERE id = $2', [ids.pageHead, ids.Ash]);

  // Menu credits: Spring 2023 on both (the page's links a drink), Winter 2022 only on the page.
  const spring = await one("INSERT INTO public.profile_worked_menus (person_profile_id, bar_profile_id, name, year) VALUES ($1, $2, 'Spring', 2023) RETURNING id", [ids.Ash, ids.Moth]);
  await db.query('INSERT INTO public.profile_worked_menu_drinks (worked_menu_id, item_id) VALUES ($1, $2)', [spring.id, ids.MothMartini]);
  ids.ownSpring = (await one("INSERT INTO public.profile_worked_menus (person_profile_id, bar_profile_id, name, year) VALUES ($1, $2, 'Spring', 2023) RETURNING id", [ids.AshOwn, ids.Moth])).id;
  await db.query("INSERT INTO public.profile_worked_menus (person_profile_id, bar_profile_id, name, year) VALUES ($1, $2, 'Winter', 2022)", [ids.Ash, ids.Moth]);

  // Awards: one on both, one only on the page.
  await db.query(
    "INSERT INTO public.profile_awards (profile_id, award, year, title) VALUES ($1, 'Bartender of the Year', 2024, 'Winner'), ($2, 'Bartender of the Year', 2024, 'Winner'), ($1, 'Rising Star', 2022, 'Finalist')",
    [ids.Ash, ids.AshOwn]
  );

  // Behind the bar at an event.
  ids.bar = (await one('INSERT INTO public.bars (name, slug) VALUES ($1, $2) RETURNING id', [`Moth ${run}`, `moth-${run}`])).id;
  const event = await one("INSERT INTO public.events (bar_id, name, starts_at) VALUES ($1, 'Takeover', now() + interval '7 days') RETURNING id", [ids.bar]);
  await db.query('INSERT INTO public.event_staff (event_id, guest_name, profile_id) VALUES ($1, $2, $3)', [event.id, 'Ash Okafor', ids.Ash]);

  // What the page shows, who loved it, and reports about it (the stranger reported both).
  await db.query("INSERT INTO public.profile_picks (profile_id, section, target_id, shown) VALUES ($1, 'originals', $2, true)", [ids.Ash, ids.MothMartini]);
  await db.query('INSERT INTO public.loved_bars (user_id, profile_id) VALUES ($1, $2)', [users.rival.id, ids.Ash]);
  await db.query(
    "INSERT INTO public.reports (reporter_id, target_kind, profile_id, reason) VALUES ($1, 'profile', $2, 'misleading'), ($1, 'profile', $3, 'misleading'), ($4, 'profile', $2, 'other')",
    [users.stranger.id, ids.Ash, ids.AshOwn, users.rival.id]
  );
});

after(async () => {
  const userIds = Object.values(users).map((u) => u.id);
  await db.query('DELETE FROM public.reports WHERE reporter_id = ANY($1)', [userIds]);
  await db.query('DELETE FROM public.items WHERE id = ANY($1)', [items]);
  await db.query('DELETE FROM public.profiles WHERE id = ANY($1)', [pages]);
  if (ids.bar) await db.query('DELETE FROM public.bars WHERE id = $1', [ids.bar]);
  await db.query('DELETE FROM private.app_admins WHERE user_id = ANY($1)', [userIds]);
  for (const id of userIds) await service.auth.admin.deleteUser(id);
  await db.end();
});

describe('starting a person claim', () => {
  test('signed-out visitors cannot claim, and nobody inserts a claim directly', async () => {
    const { error } = await anon.rpc('start_person_claim', { p_profile_id: ids.Ash, p_method: 'note' });
    assert.ok(error, 'anon has no execute');
    const direct = await users.stranger.client.from('profile_claims').insert({ profile_id: ids.Ash, message: 'This is me' });
    assert.ok(direct.error, 'no direct person claim');
    const privileges = await one(
      `SELECT has_function_privilege('anon', 'public.start_person_claim(uuid, public.claim_method, text, text, uuid)', 'execute') AS anon_start,
              has_function_privilege('authenticated', 'private.merge_person_profile(uuid, uuid, uuid, uuid)', 'execute') AS user_merge,
              has_function_privilege('authenticated', 'private.hand_over_claim(uuid, uuid)', 'execute') AS user_hand_over,
              has_table_privilege('authenticated', 'private.profile_merges', 'select') AS user_merges,
              has_table_privilege('authenticated', 'public.profile_claims', 'insert') AS user_insert`
    );
    assert.deepEqual(privileges, { anon_start: false, user_merge: false, user_hand_over: false, user_merges: false, user_insert: false });
  });

  test('someone with a profile claims a seeded page by an Instagram code', async () => {
    const { data, error } = await claim('ash', 'Ash', 'instagram', { p_code: '482913', p_note: 'Ash, head bartender' });
    assert.ifError(error);
    assert.equal(data.status, 'pending');
    assert.equal(data.method, 'instagram');
    assert.equal(data.code, '482913');
    assert.equal(data.evidence.instagram, `ash.okafor${run}`);
    assert.equal(data.evidence.instagram_dm, true);
    ids.ashClaim = data.id;
  });

  test('the Instagram code needs a page with an Instagram, and only these two ways work', async () => {
    const noGram = await claim('rival', 'NoGram', 'instagram');
    assert.match(noGram.error?.message ?? '', /no Instagram/);
    const email = await claim('rival', 'NoGram', 'email');
    assert.equal(email.error?.code, '22023');
    const badCode = await claim('rival', 'Spare', 'instagram', { p_code: '12ab56' });
    assert.equal(badCode.error?.code, '22023');
  });

  test('a claimed page, or a bar\'s page, cannot be claimed this way', async () => {
    const taken = await claim('rival', 'Taken');
    assert.match(taken.error?.message ?? '', /already been claimed/);
    const own = await claim('ash', 'AshOwn');
    assert.match(own.error?.message ?? '', /already been claimed/);
    const bar = await claim('rival', 'Moth');
    assert.match(bar.error?.message ?? '', /no person's page/);
    const hidden = await claim('rival', 'Hidden');
    assert.match(hidden.error?.message ?? '', /no person's page/, 'a taken-down page is not claimable');
  });

  test('nobody claims the same page twice, or two pages at once', async () => {
    const again = await claim('ash', 'Ash');
    assert.equal(again.error?.code, '23505');
    const other = await claim('ash', 'Spare');
    assert.match(other.error?.message ?? '', /claim waiting on another page/);
  });

  test('someone without a profile can still claim, and a second person can claim the same page', async () => {
    const { data, error } = await claim('rival', 'Ash', 'note', { p_note: 'Me too' });
    assert.ifError(error);
    assert.equal(data.method, 'note');
    assert.equal(data.code, null);
    ids.rivalClaim = data.id;
  });

  test('three claims a day, as before', async () => {
    for (const n of [1, 2, 3]) {
      const { data, error } = await claim('busy', `Busy${n}`);
      assert.ifError(error);
      // Turned down, so the next one isn't blocked by a waiting claim.
      await db.query("UPDATE public.profile_claims SET status = 'rejected', reviewed_at = now() WHERE id = $1", [data.id]);
    }
    const fourth = await claim('busy', 'Busy4');
    assert.match(fourth.error?.message ?? '', /three claims today/);
  });

  test('only moderators approve, and claims stay private to their claimant', async () => {
    const { error } = await users.ash.client.rpc('approve_profile_claim', { p_claim_id: ids.ashClaim });
    assert.match(error?.message ?? '', /Only moderators/);
    const { data } = await users.stranger.client.from('profile_claims').select('id').eq('id', ids.ashClaim);
    assert.deepEqual(data ?? [], []);
  });
});

describe('approving merges the page into their profile', () => {
  test('a stray reference stops the merge, and nothing changes', async () => {
    await db.query('BEGIN');
    try {
      // A table added later that the merge doesn't know about. Rolled back below.
      await db.query(`CREATE TABLE public.stray_${run} (profile_id uuid REFERENCES public.profiles(id))`);
      await db.query(`INSERT INTO public.stray_${run} VALUES ($1)`, [ids.Ash]);
      await assert.rejects(
        db.query('SELECT private.merge_person_profile($1, $2, NULL, NULL)', [ids.Ash, ids.AshOwn]),
        /still points at the page/
      );
    } finally {
      await db.query('ROLLBACK');
    }
    assert.ok(await one('SELECT id FROM public.profiles WHERE id = $1', [ids.Ash]));
    assert.equal(await count('SELECT 1 FROM public.items WHERE creator_profile_id = $1', [ids.Ash]), 1);
  });

  test('the moderator approves, and everything on the page moves to Ash\'s profile', async () => {
    const { data, error } = await users.moderator.client.rpc('approve_profile_claim', { p_claim_id: ids.ashClaim });
    assert.ifError(error);
    assert.equal(data.id, ids.AshOwn, 'returns the profile it merged into');

    assert.equal(await one('SELECT id FROM public.profiles WHERE id = $1', [ids.Ash]), undefined, 'the seeded row is gone');

    // Drinks.
    assert.equal((await one('SELECT creator_profile_id FROM public.items WHERE id = $1', [ids.MothMartini])).creator_profile_id, ids.AshOwn);
    assert.equal(await count('SELECT 1 FROM public.item_co_creators WHERE item_id = $1', [ids.OwnSour]), 0, 'no co-credit on their own drink');
    assert.deepEqual((await db.query('SELECT profile_id FROM public.item_co_creators WHERE item_id = $1', [ids.Shared])).rows, [{ profile_id: ids.AshOwn }]);

    // Jobs: one Head bartender, filled in; Bartender moved; the headline follows.
    const jobs = (await db.query('SELECT id, title, start_year, bar_accepted FROM public.profile_positions WHERE person_profile_id = $1 ORDER BY title', [ids.AshOwn])).rows;
    assert.deepEqual(jobs.map((j) => j.title), ['Bartender', 'Head bartender']);
    assert.equal(jobs[1].id, ids.ownHead);
    assert.equal(jobs[1].start_year, 2021);
    assert.equal(jobs[1].bar_accepted, true);
    assert.equal(jobs[0].id, ids.pageJob);
    const own = await one('SELECT bio, tagline, instagram, website, social_links, headline_position_id, display_name FROM public.profiles WHERE id = $1', [ids.AshOwn]);
    assert.equal(own.headline_position_id, ids.ownHead);

    // Menu credits: one Spring 2023 with the drink, and Winter.
    const menus = (await db.query('SELECT id, name FROM public.profile_worked_menus WHERE person_profile_id = $1 ORDER BY name', [ids.AshOwn])).rows;
    assert.deepEqual(menus.map((m) => m.name), ['Spring', 'Winter']);
    assert.equal(menus[0].id, ids.ownSpring);
    assert.deepEqual((await db.query('SELECT item_id FROM public.profile_worked_menu_drinks WHERE worked_menu_id = $1', [ids.ownSpring])).rows, [{ item_id: ids.MothMartini }]);

    // Awards, events, picks, loves, reports.
    assert.deepEqual((await db.query('SELECT award FROM public.profile_awards WHERE profile_id = $1 ORDER BY award', [ids.AshOwn])).rows.map((r) => r.award), ['Bartender of the Year', 'Rising Star']);
    assert.equal(await count('SELECT 1 FROM public.event_staff WHERE profile_id = $1', [ids.AshOwn]), 1);
    assert.equal(await count('SELECT 1 FROM public.profile_picks WHERE profile_id = $1', [ids.AshOwn]), 1);
    assert.equal(await count('SELECT 1 FROM public.loved_bars WHERE profile_id = $1', [ids.AshOwn]), 1);
    assert.equal(await count('SELECT 1 FROM public.reports WHERE profile_id = $1', [ids.AshOwn]), 2, 'the duplicate report is dropped, the other moves');

    // The page's words fill Ash's blanks; what they filled in, and their name, stay.
    assert.equal(own.bio, 'Head bartender at Pale Moth.');
    assert.equal(own.tagline, 'Stirred, mostly.');
    assert.equal(own.instagram, `ash.okafor${run}`);
    assert.deepEqual(own.social_links, ['https://www.tiktok.com/@ashokafor']);
    assert.equal(own.website, 'https://ash.example.com', 'their own website is not overwritten');
    assert.equal(own.display_name, 'Ash');
  });

  test('claims move with the page: Ash sees theirs approved, the other is turned down', async () => {
    const { data, error } = await users.ash.client.from('profile_claims').select('id, profile_id, status, evidence').eq('id', ids.ashClaim).single();
    assert.ifError(error);
    assert.equal(data.status, 'approved');
    assert.equal(data.profile_id, ids.AshOwn);
    assert.equal(data.evidence.merged_from.id, ids.Ash);
    const rival = await users.rival.client.from('profile_claims').select('status, decline_reason').eq('id', ids.rivalClaim).single();
    assert.equal(rival.data.status, 'rejected');
    assert.match(rival.data.decline_reason, /Someone else claimed this page first/);
  });

  test('the merge keeps the old page and every dropped duplicate', async () => {
    const merge = await one('SELECT * FROM private.profile_merges WHERE from_profile_id = $1', [ids.Ash]);
    assert.equal(merge.into_profile_id, ids.AshOwn);
    assert.equal(merge.claim_id, ids.ashClaim);
    assert.equal(merge.merged_by, users.moderator.id);
    assert.equal(merge.snapshot.handle, `ash${run}`);
    assert.deepEqual(Object.keys(merge.dropped).sort(), ['item_co_creators', 'profile_awards', 'profile_positions', 'profile_worked_menus', 'reports']);
    assert.equal(merge.dropped.profile_positions[0].start_year, 2021);
  });

  test('merging again changes nothing, and the claim cannot be approved twice', async () => {
    const before = await count('SELECT 1 FROM public.profile_positions WHERE person_profile_id = $1', [ids.AshOwn]);
    const again = await one('SELECT (private.merge_person_profile($1, $2, NULL, NULL)).id', [ids.Ash, ids.AshOwn]);
    assert.equal(again.id, ids.AshOwn);
    assert.equal(await count('SELECT 1 FROM public.profile_positions WHERE person_profile_id = $1', [ids.AshOwn]), before);
    assert.equal(await count('SELECT 1 FROM private.profile_merges WHERE from_profile_id = $1', [ids.Ash]), 1);
    const { error } = await users.moderator.client.rpc('approve_profile_claim', { p_claim_id: ids.ashClaim });
    assert.match(error?.message ?? '', /No pending claim/);
  });

  test('only an unclaimed person merges, and only into someone\'s own profile', async () => {
    await assert.rejects(db.query('SELECT private.merge_person_profile($1, $2, NULL, NULL)', [ids.Spare, ids.Moth]), /only be merged into someone's own profile/);
    await assert.rejects(db.query('SELECT private.merge_person_profile($1, $2, NULL, NULL)', [ids.Taken, ids.AshOwn]), /Only an unclaimed person's page/);
  });
});

describe('old links to a merged page', () => {
  const moved = (client, ref) => client.rpc('merged_profile_handle', { p_ref: ref });

  test('the old handle or id leads to the claimant\'s handle, for anyone', async () => {
    const own = `ashown${run}`;
    for (const ref of [`ash${run}`, `@Ash${run}`, ids.Ash, ids.Ash.toUpperCase()]) {
      const { data, error } = await moved(anon, ref);
      assert.ifError(error);
      assert.equal(data, own, ref);
    }
    assert.equal((await moved(users.stranger.client, `ash${run}`)).data, own);
  });

  test('a handle never merged, or a page still live, leads nowhere', async () => {
    for (const ref of [`nobody${run}`, `spare${run}`, ids.Spare, randomUUID(), '']) {
      const { data, error } = await moved(anon, ref);
      assert.ifError(error);
      assert.equal(data, null, ref);
    }
  });

  test('a private or blocked claimant is only found by themselves', async () => {
    await db.query('UPDATE public.profiles SET is_public = false WHERE id = $1', [ids.AshOwn]);
    try {
      assert.equal((await moved(anon, `ash${run}`)).data, null);
      assert.equal((await moved(users.stranger.client, `ash${run}`)).data, null);
      assert.equal((await moved(users.ash.client, `ash${run}`)).data, `ashown${run}`, 'their own, even private');
    } finally {
      await db.query('UPDATE public.profiles SET is_public = true WHERE id = $1', [ids.AshOwn]);
    }
    await db.query('INSERT INTO public.user_blocks (blocker_id, blocked_id) VALUES ($1, $2)', [users.ash.id, users.rival.id]);
    try {
      assert.equal((await moved(users.rival.client, `ash${run}`)).data, null);
    } finally {
      await db.query('DELETE FROM public.user_blocks WHERE blocker_id = $1', [users.ash.id]);
    }
  });

  test('only the handle comes back, and nobody can read the merges', async () => {
    const { data } = await moved(anon, `ash${run}`);
    assert.equal(typeof data, 'string');
    const privileges = await one(
      `SELECT has_function_privilege('anon', 'public.merged_profile_handle(text)', 'execute') AS anon_lookup,
              has_table_privilege('anon', 'private.profile_merges', 'select') AS anon_merges`
    );
    assert.deepEqual(privileges, { anon_lookup: true, anon_merges: false });
  });
});

describe('approving for someone without a profile', () => {
  test('hands the page over, as before, with no merge', async () => {
    const fresh = await claim('fresh', 'NoGram', 'note', { p_note: 'This is me' });
    assert.ifError(fresh.error);
    const { data, error } = await users.moderator.client.rpc('approve_profile_claim', { p_claim_id: fresh.data.id });
    assert.ifError(error);
    assert.equal(data.id, ids.NoGram);
    assert.equal((await one('SELECT user_id FROM public.profiles WHERE id = $1', [ids.NoGram])).user_id, users.fresh.id);
    assert.equal(await count('SELECT 1 FROM private.profile_merges WHERE from_profile_id = $1', [ids.NoGram]), 0);
  });
});
