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
  await page('Glassworks', { kind: 'maker', makes: ['glassware'] });
});

after(async () => {
  const claimed = (await db.query('SELECT bar_id FROM public.profiles WHERE id = ANY($1) AND bar_id IS NOT NULL', [Object.values(pages)])).rows.map((r) => r.bar_id);
  await db.query('DELETE FROM public.items WHERE id = ANY($1::uuid[])', [[ids.drink, ids.bottle, ids.homeDrink].filter(Boolean)]);
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

  test("a home drink's origin bar doesn't let its owner confirm that bar's ice (20261011155500)", async () => {
    ids.homeDrink = (
      await db.query(`INSERT INTO public.items (name, item_type, created_by, origin_bar_profile_id) VALUES ($1, 'cocktail', $2, $3) RETURNING id`, [
        `Home Ice Drink ${run}`,
        users.stranger.id,
        pages.Pub,
      ])
    ).rows[0].id;
    const claim = await users.stranger.client.from('item_maker_credits').insert({ item_id: ids.homeDrink, profile_id: pages.Pub, makes: 'ice' }).select('confirmed_at');
    assert.match(claim.error?.message ?? '', /doesn't say it makes ice/, 'a bar page is credited for ice on its own venue\'s drinks only');
    const { rows } = await db.query('SELECT count(*)::int AS n FROM public.item_maker_credits WHERE item_id = $1', [ids.homeDrink]);
    assert.equal(rows[0].n, 0);
  });

  test("a bar's glass names its maker's page, only one that makes glassware (20261012430000)", async () => {
    const glass = (
      await db.query(`INSERT INTO public.bar_glassware (profile_id, glass, name, maker) VALUES ($1, 'coupe', $2, $3) RETURNING id`, [
        pages.Pub,
        `Leopold coupe ${run}`,
        `Glassworks ${run}`,
      ])
    ).rows[0].id;
    await assert.rejects(db.query('UPDATE public.bar_glassware SET maker_profile_id = $1 WHERE id = $2', [pages.Clearcut, glass]), /makes glassware/, 'an ice maker');
    await assert.rejects(db.query('UPDATE public.bar_glassware SET maker_profile_id = $1 WHERE id = $2', [pages.Pub, glass]), /makes glassware/, "a bar's page");
    await db.query('UPDATE public.bar_glassware SET maker_profile_id = $1 WHERE id = $2', [pages.Glassworks, glass]);
    const { data, error } = await users.stranger.client
      .from('bar_glassware')
      .select('name, bar:profiles!bar_glassware_profile_id_fkey(id), maker_page:profiles!bar_glassware_maker_profile_id_fkey(id)')
      .eq('maker_profile_id', pages.Glassworks);
    assert.equal(error, null);
    assert.deepEqual(data, [{ name: `Leopold coupe ${run}`, bar: { id: pages.Pub }, maker_page: { id: pages.Glassworks } }], "signed-in people see which bars use the maker's glasses");
    // The migration's link by name: a glass whose maker text is the page's name.
    const second = (
      await db.query(`INSERT INTO public.bar_glassware (profile_id, glass, maker) VALUES ($1, 'nick', $2) RETURNING id`, [pages.Pub, `glassworks ${run}`])
    ).rows[0].id;
    await db.query(`UPDATE public.bar_glassware g SET maker_profile_id = p.id FROM public.profiles p
                     WHERE g.id = $1 AND g.maker_profile_id IS NULL AND p.kind = 'maker' AND 'glassware' = ANY (p.makes)
                       AND public.ingredient_key(p.display_name) = public.ingredient_key(g.maker)`, [second]);
    const { rows } = await db.query('SELECT maker_profile_id FROM public.bar_glassware WHERE id = $1', [second]);
    assert.equal(rows[0].maker_profile_id, pages.Glassworks, 'matched by name, ignoring case');
    await db.query('DELETE FROM public.bar_glassware WHERE id = ANY($1::uuid[])', [[glass, second]]);
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

  test("a maker's team sees the credits waiting for it (20261011154000); nobody else does", async () => {
    const add = await users.editor.client.from('item_maker_credits').insert({ item_id: ids.drink, profile_id: pages.Team, makes: 'ice' });
    assert.equal(add.error, null);
    const { data, error } = await users.publisher.client.rpc('maker_credit_requests', { p_bar_id: ids.team });
    assert.equal(error, null);
    assert.deepEqual(
      data.map(({ item_id, makes, drink_name, credited_by }) => ({ item_id, makes, drink_name, credited_by })),
      [{ item_id: ids.drink, makes: 'ice', drink_name: `Ice Old Fashioned ${run}`, credited_by: `OwnBar ${run}` }],
      'the drink and its bar by its page name, even though the drink is private to the bar'
    );
    for (const who of ['editor', 'stranger']) {
      const other = await users[who].client.rpc('maker_credit_requests', { p_bar_id: ids.team });
      assert.deepEqual(other.data, [], `${who} is not on the maker's team`);
    }
    const signedOut = await anon.rpc('maker_credit_requests', { p_bar_id: ids.team });
    assert.ok(signedOut.error, 'signed-out people cannot ask');
    await users.publisher.client.rpc('confirm_maker_credit', { p_item_id: ids.drink, p_profile_id: pages.Team, p_makes: 'ice' });
    const after = await users.publisher.client.rpc('maker_credit_requests', { p_bar_id: ids.team });
    assert.deepEqual(after.data, [], 'confirmed credits leave the inbox');
    await db.query('DELETE FROM public.item_maker_credits WHERE item_id = $1', [ids.drink]);
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
