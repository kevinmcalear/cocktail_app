// Maker pages (20261011152000_maker_kind.sql, 20261011152100_makers.sql): a
// maker's page is owned by a venue team like a bar's and claimed the same
// way, never holds an address (so never a map pin) and never shows up in
// Discover's bar lists; a bottle names its maker; a drink credits who made
// its ice or glass; only moderators set a maker's group.
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
  throw new Error(`Refusing to run maker tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });
const CITY = `Icetown ${run}`;

const users = {};
const pages = {};
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

async function page(key, fields) {
  const { data, error } = await service
    .from('profiles')
    .insert({ handle: `${key}${run}`.toLowerCase(), display_name: `${key} ${run}`, is_public: true, ...fields })
    .select('id')
    .single();
  if (error) throw new Error(`fixture page failed: ${error.message}`);
  pages[key] = data.id;
  return data.id;
}

before(async () => {
  await db.connect();
  for (const label of ['publisher', 'editor', 'stranger', 'claimer', 'moderator']) users[label] = await makeUser(label);
  await db.query('INSERT INTO private.app_admins (user_id) VALUES ($1)', [users.moderator.id]);
  await db.query("SET app.image_worker = 'on'");

  // A venue team whose publisher can make a page for it; a drink at that venue.
  ids.team = (await db.query('INSERT INTO public.bars (name) VALUES ($1) RETURNING id', [`Ice Team ${run}`])).rows[0].id;
  ids.bar = (await db.query('INSERT INTO public.bars (name) VALUES ($1) RETURNING id', [`Drink Bar ${run}`])).rows[0].id;
  await db.query('INSERT INTO public.user_bars (bar_id, user_id, role_level) VALUES ($1, $2, 40), ($3, $4, 40)', [ids.team, users.publisher.id, ids.bar, users.editor.id]);
  ids.drink = (await db.query(`INSERT INTO public.items (name, item_type, bar_id) VALUES ($1, 'cocktail', $2) RETURNING id`, [`Ice Old Fashioned ${run}`, ids.bar])).rows[0].id;
  ids.bottle = (await db.query(`INSERT INTO public.items (name, item_type, ingredient_role) VALUES ($1, 'ingredient', 'product') RETURNING id`, [`Maker Test Gin ${run}`])).rows[0].id;

  await page('Clearcut', { kind: 'maker', makes: ['ice'], city: CITY, instagram: `clearcut${run}` });
  await page('Stillhouse', { kind: 'maker', makes: ['bottles'] });
  await page('Group', { kind: 'maker', makes: ['bottles'] });
  await page('Pub', { kind: 'bar', city: CITY });
});

after(async () => {
  const claimed = (await db.query('SELECT bar_id FROM public.profiles WHERE id = ANY($1) AND bar_id IS NOT NULL', [Object.values(pages)])).rows.map((r) => r.bar_id);
  await db.query('DELETE FROM public.items WHERE id = ANY($1::uuid[])', [[ids.drink, ids.bottle]]);
  await db.query('DELETE FROM public.profiles WHERE id = ANY($1)', [Object.values(pages)]);
  await db.query('DELETE FROM public.bars WHERE id = ANY($1)', [[ids.team, ids.bar, ...claimed]]);
  const userIds = Object.values(users).map((u) => u.id);
  await db.query('DELETE FROM private.app_admins WHERE user_id = ANY($1)', [userIds]);
  for (const id of userIds) await service.auth.admin.deleteUser(id);
  await db.end();
});

describe('maker pages', () => {
  test("a venue's publisher makes and edits its maker page; nobody else can", async () => {
    const mine = await users.publisher.client
      .from('profiles')
      .insert({ kind: 'maker', handle: `teamice${run}`, display_name: `Team Ice ${run}`, bar_id: ids.team, makes: ['ice', 'garnish'] })
      .select('id, is_public')
      .single();
    assert.equal(mine.error, null);
    assert.equal(mine.data.is_public, true, 'a maker page is public by default, like a bar');
    pages.Team = mine.data.id;
    const edit = await users.publisher.client.from('profiles').update({ bio: 'Clear ice, cut by hand.' }).eq('id', pages.Team).select('id');
    assert.equal(edit.data?.length, 1);
    const theirs = await users.stranger.client.from('profiles').update({ bio: 'mine now' }).eq('id', pages.Team).select('id');
    assert.equal(theirs.data?.length ?? 0, 0);
    const forOther = await users.stranger.client.from('profiles').insert({ kind: 'maker', handle: `fake${run}`, display_name: 'Fake', bar_id: ids.team });
    assert.ok(forOther.error, "a stranger can't make a page for someone else's team");
  });

  test('a maker page is owned by a team, never a person, and never has an address', async () => {
    await assert.rejects(
      db.query(`INSERT INTO public.profiles (kind, handle, display_name, user_id) VALUES ('maker', $1, 'Solo', $2)`, [`solo${run}`, users.stranger.id]),
      /profiles_owner_matches_kind/
    );
    await assert.rejects(db.query('UPDATE public.profiles SET latitude = 10, longitude = 20 WHERE id = $1', [pages.Clearcut]), /profiles_person_has_no_address/);
    await assert.rejects(db.query(`UPDATE public.profiles SET address_line = '1 Cold St' WHERE id = $1`, [pages.Clearcut]), /profiles_person_has_no_address/);
  });

  test('only makers say what they make, from the known list', async () => {
    await assert.rejects(db.query(`UPDATE public.profiles SET makes = '{ice}' WHERE id = $1`, [pages.Pub]), /profiles_makes_known/);
    await assert.rejects(db.query(`UPDATE public.profiles SET makes = '{napkins}' WHERE id = $1`, [pages.Clearcut]), /profiles_makes_known/);
  });

  test('a maker lists the cities it delivers to; nobody else does', async () => {
    const ok = await users.publisher.client.from('profiles').update({ serves: ['New York', 'Jersey City'] }).eq('id', pages.Team).select('serves').single();
    assert.equal(ok.error, null);
    assert.deepEqual(ok.data.serves, ['New York', 'Jersey City']);
    await assert.rejects(db.query(`UPDATE public.profiles SET serves = '{London}' WHERE id = $1`, [pages.Pub]), /profiles_serves_cities/);
    await assert.rejects(db.query(`UPDATE public.profiles SET serves = ARRAY['  '] WHERE id = $1`, [pages.Clearcut]), /profiles_serves_cities/);
    const { data } = await anon.from('profiles').select('serves').eq('id', pages.Team).single();
    assert.deepEqual(data.serves, ['New York', 'Jersey City'], 'signed-out visitors see where a maker delivers');
  });

  test('a bar that cuts its own ice credits itself, confirmed at once; not another bar', async () => {
    const own = await page('OwnBar', { kind: 'bar', bar_id: ids.bar });
    const self = await users.editor.client.from('item_maker_credits').insert({ item_id: ids.drink, profile_id: own, makes: 'ice' }).select('confirmed_at').single();
    assert.equal(self.error, null);
    assert.ok(self.data.confirmed_at, 'its own ice needs no one else to confirm');
    const glass = await users.editor.client.from('item_maker_credits').insert({ item_id: ids.drink, profile_id: own, makes: 'glassware' });
    assert.ok(glass.error, 'a bar credits itself for ice only');
    const other = await users.editor.client.from('item_maker_credits').insert({ item_id: ids.drink, profile_id: pages.Pub, makes: 'ice' });
    assert.ok(other.error, "another bar isn't this drink's ice maker");
    await db.query('DELETE FROM public.item_maker_credits WHERE item_id = $1 AND profile_id = $2', [ids.drink, own]);
  });

  test('makers stay out of Discover and the map', async () => {
    const { data, error } = await anon.rpc('discover_top_bars', { p_city: CITY });
    assert.equal(error, null);
    const shown = (data ?? []).map((r) => JSON.stringify(r)).join(' ');
    assert.ok(!shown.includes(pages.Clearcut), 'a maker in the city is not a top bar');
  });

  test('only moderators set the group a maker belongs to, and it is a maker', async () => {
    const owner = await users.publisher.client.from('profiles').update({ part_of_profile_id: pages.Group }).eq('id', pages.Team).select('id');
    assert.ok(owner.error, "a maker's own team can't claim a famous parent");
    const mod = await users.moderator.client.from('profiles').update({ part_of_profile_id: pages.Group }).eq('id', pages.Stillhouse).select('part_of_profile_id').single();
    assert.equal(mod.error, null);
    assert.equal(mod.data.part_of_profile_id, pages.Group);
    const barGroup = await users.moderator.client.from('profiles').update({ part_of_profile_id: pages.Pub }).eq('id', pages.Clearcut);
    assert.ok(barGroup.error, 'a bar is not a group');
    const { data } = await anon.from('profiles').select('makes, part_of_profile_id').eq('id', pages.Stillhouse).single();
    assert.deepEqual(data, { makes: ['bottles'], part_of_profile_id: pages.Group }, 'signed-out visitors read both');
  });

  test("a bottle names its maker; only a maker's page will do", async () => {
    await db.query('UPDATE public.items SET maker_profile_id = $1 WHERE id = $2', [pages.Stillhouse, ids.bottle]);
    await assert.rejects(db.query('UPDATE public.items SET maker_profile_id = $1 WHERE id = $2', [pages.Pub, ids.bottle]), /maker's page/);
    await assert.rejects(db.query('UPDATE public.items SET maker_profile_id = $1 WHERE id = $2', [pages.Stillhouse, ids.drink]), /Only an ingredient/);
    const { data } = await users.stranger.client.from('items').select('maker_profile_id').eq('id', ids.bottle).single();
    assert.equal(data.maker_profile_id, pages.Stillhouse, 'signed-in people see who makes it');
  });

  test("a drink's editors credit who made its ice; the maker's team can take it off", async () => {
    const wrong = await users.editor.client.from('item_maker_credits').insert({ item_id: ids.drink, profile_id: pages.Stillhouse, makes: 'ice' });
    assert.ok(wrong.error, "Stillhouse doesn't make ice");
    const stranger = await users.stranger.client.from('item_maker_credits').insert({ item_id: ids.drink, profile_id: pages.Team, makes: 'ice' });
    assert.ok(stranger.error, "someone who can't edit the drink can't credit it");
    const ok = await users.editor.client.from('item_maker_credits').insert({ item_id: ids.drink, profile_id: pages.Team, makes: 'ice', confirmed_at: new Date().toISOString() }).select('makes');
    assert.equal(ok.error, null);
    const read = await users.editor.client.from('item_maker_credits').select('profile_id, makes, confirmed_at').eq('item_id', ids.drink);
    assert.deepEqual(read.data, [{ profile_id: pages.Team, makes: 'ice', confirmed_at: null }], 'unconfirmed until the maker says so');
    const notTheirs = await users.editor.client.rpc('confirm_maker_credit', { p_item_id: ids.drink, p_profile_id: pages.Team, p_makes: 'ice' });
    assert.match(notTheirs.error?.message ?? '', /maker's own team/, "the bar can't confirm on the maker's behalf");
    const sneaky = await users.editor.client.from('item_maker_credits').update({ confirmed_at: new Date().toISOString() }).eq('item_id', ids.drink).select('makes');
    assert.equal(sneaky.data?.length ?? 0, 0, 'nor set it directly');
    const yes = await users.publisher.client.rpc('confirm_maker_credit', { p_item_id: ids.drink, p_profile_id: pages.Team, p_makes: 'ice' });
    assert.equal(yes.error, null);
    assert.ok(yes.data, 'the maker confirms it');
    const off = await users.publisher.client.from('item_maker_credits').delete().eq('item_id', ids.drink).select('makes');
    assert.equal(off.data?.length, 1, "the maker's own team can take its credit off");
  });

  test('a maker page is claimed like a bar page: a venue with the claimant as Admin', async () => {
    const { data, error } = await users.claimer.client.rpc('start_bar_claim', { p_profile_id: pages.Clearcut, p_method: 'instagram' });
    assert.equal(error, null);
    assert.ok(data.code, 'an Instagram claim gets a code');
    const twice = await users.claimer.client.rpc('start_bar_claim', { p_profile_id: pages.Clearcut, p_method: 'instagram' });
    assert.match(twice.error?.message ?? '', /claim waiting on this maker/);
    const approved = await users.moderator.client.rpc('approve_profile_claim', { p_claim_id: data.id });
    assert.equal(approved.error, null);
    const { rows } = await db.query(
      'SELECT p.bar_id, ub.role_level FROM public.profiles p JOIN public.user_bars ub ON ub.bar_id = p.bar_id AND ub.user_id = $2 WHERE p.id = $1',
      [pages.Clearcut, users.claimer.id]
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].role_level, 40);
  });
});
