// Row-level security and behaviour tests for the schema proposal's draft
// migrations (docs/schema_proposal.md): venue identity, venue roles, the back
// bar, prep and purchasing, profiles and credit, events, home bar and rankings.
// Runs through the real API as real users.
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
  throw new Error(`Refusing to run venue platform tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const users = {};
const ids = {};
const extraUserIds = [];

async function makeUser(label, { signIn = true } = {}) {
  const email = `${label}-${run}@security-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  if (!signIn) return { id: data.user.id };
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

// Rows the caller can see, as a set of ids (or another key).
async function visible(client, table, column, values, key = column) {
  const { data, error } = await client.from(table).select(key).in(column, values);
  assert.ifError(error);
  return new Set(data.map((r) => r[key]));
}

const hour = 60 * 60 * 1000;

before(async () => {
  await db.connect();

  for (const label of [
    'admin', 'maker', 'bartender', 'floor', 'guest', 'barback', 'headBartender',
    'guestBartender', 'expiredGuest', 'otherAdmin', 'outsider', 'catalogAdmin', 'homeUser',
  ]) {
    users[label] = await makeUser(label);
  }
  await db.query('INSERT INTO private.app_admins (user_id) VALUES ($1)', [users.catalogAdmin.id]);

  ids.barOne = (await serviceInsert('bars', { name: `Little Rye ${run}` })).id;
  ids.barTwo = (await serviceInsert('bars', { name: `Pale Moth ${run}` })).id;
  ids.barThree = (await serviceInsert('bars', { name: `Back Room ${run}` })).id;

  ids.barbackRole = (
    await serviceInsert('venue_roles', { bar_id: ids.barOne, name: 'Barback', base_level: 20, granted: ['house_made', 'prep'] })
  ).id;
  ids.headRole = (
    await serviceInsert('venue_roles', { bar_id: ids.barOne, name: 'Head bartender', base_level: 35, granted: ['costs'] })
  ).id;
  ids.guestRole = (
    await serviceInsert('venue_roles', {
      bar_id: ids.barOne, name: 'Guest bartender', base_level: 35, revoked: ['house_made', 'prep'],
      ends_at: new Date(Date.now() + 24 * hour).toISOString(),
    })
  ).id;
  ids.expiredRole = (
    await serviceInsert('venue_roles', {
      bar_id: ids.barOne, name: 'Last week guest', base_level: 35, ends_at: new Date(Date.now() - hour).toISOString(),
    })
  ).id;
  ids.barTwoRole = (await serviceInsert('venue_roles', { bar_id: ids.barTwo, name: 'Floor', base_level: 20 })).id;

  for (const [label, bar, role, venueRole] of [
    ['admin', ids.barOne, 40],
    ['maker', ids.barOne, 35],
    ['bartender', ids.barOne, 30],
    ['floor', ids.barOne, 20],
    ['guest', ids.barOne, 10],
    // Deliberately the wrong level: the role's base level wins.
    ['barback', ids.barOne, 10, ids.barbackRole],
    ['headBartender', ids.barOne, 10, ids.headRole],
    ['guestBartender', ids.barOne, 10, ids.guestRole],
    ['expiredGuest', ids.barOne, 10, ids.expiredRole],
    ['otherAdmin', ids.barTwo, 40],
    ['otherAdmin', ids.barThree, 40],
  ]) {
    await serviceInsert('user_bars', { user_id: users[label].id, bar_id: bar, role_level: role, venue_role_id: venueRole ?? null });
  }

  ids.syrup = (await serviceInsert('items', { name: `Honey-ginger syrup ${run}`, item_type: 'ingredient', bar_id: ids.barOne })).id;
  ids.penicillin = (await serviceInsert('items', { name: `Penicillin ${run}`, item_type: 'cocktail', bar_id: ids.barOne })).id;
  ids.penicillinRecipe = (
    await serviceInsert('recipes', { recipe_item_id: ids.penicillin, ingredient_item_id: ids.syrup, amount: 22.5, unit: 'ml', sort_order: 0 })
  ).id;
  ids.barTwoDrink =(await serviceInsert('items', { name: `Moth Colada ${run}`, item_type: 'cocktail', bar_id: ids.barTwo })).id;
  ids.scotch = (await serviceInsert('items', { name: `Blended Scotch ${run}`, item_type: 'ingredient', created_by: null })).id;
  ids.martini = (await serviceInsert('items', { name: `Martini ${run}`, item_type: 'cocktail', created_by: null })).id;

  ids.fridge = (await serviceInsert('bar_zones', { bar_id: ids.barOne, name: 'Fridge 2', kind: 'fridge' })).id;
  ids.barTwoZone = (await serviceInsert('bar_zones', { bar_id: ids.barTwo, name: 'Shelf 1' })).id;
  ids.location = (
    await serviceInsert('item_locations', {
      bar_id: ids.barOne, item_id: ids.syrup, zone_id: ids.fridge, shelf: 'Top', container: '1 L squeeze bottle',
    })
  ).id;
  await serviceInsert('item_prep', { item_id: ids.syrup, yield_amount: 1.2, yield_unit: 'L', shelf_life_hours: 168, par_amount: 2, par_unit: 'L' });
  ids.supplier = (await serviceInsert('suppliers', { bar_id: ids.barOne, name: `Bottle-O ${run}` })).id;
  await serviceInsert('item_purchasing', { bar_id: ids.barOne, item_id: ids.scotch, supplier_id: ids.supplier, pack_size_amount: 700, pack_size_unit: 'ml' });
  await serviceInsert('item_costs', { bar_id: ids.barOne, item_id: ids.scotch, pack_cost_minor: 4500, currency: 'AUD' });

  ids.barOneProfile = (
    await serviceInsert('profiles', {
      kind: 'bar', handle: `rye${run}`, display_name: `Little Rye ${run}`, bar_id: ids.barOne, is_public: true,
      locality: 'Brunswick', postcode: '3056', city: 'Melbourne', country_code: 'AU',
    })
  ).id;
  ids.barTwoProfile = (
    await serviceInsert('profiles', { kind: 'bar', handle: `moth${run}`, display_name: `Pale Moth ${run}`, bar_id: ids.barTwo, is_public: true })
  ).id;
  ids.barThreeProfile = (
    await serviceInsert('profiles', { kind: 'bar', handle: `backroom${run}`, display_name: `Back Room ${run}`, bar_id: ids.barThree })
  ).id;
  ids.samProfile = (
    await serviceInsert('profiles', { kind: 'person', handle: `sam${run}`, display_name: 'Sam', is_public: true })
  ).id;
  ids.privateProfile = (
    await serviceInsert('profiles', { kind: 'person', handle: `quiet${run}`, display_name: 'Quiet', user_id: users.homeUser.id })
  ).id;

  ids.barOneMenu = (await serviceInsert('menus', { name: `Takeover menu ${run}`, bar_id: ids.barOne })).id;
  ids.barTwoMenu = (await serviceInsert('menus', { name: `Night garden ${run}`, bar_id: ids.barTwo })).id;
});

after(async () => {
  const like = `%${run}%`;
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.menus WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.profiles WHERE handle LIKE $1', [like]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  for (const id of extraUserIds) await service.auth.admin.deleteUser(id);
  await db.query('SELECT private.refresh_rankings()');
  await db.end();
});

describe('venue identity', () => {
  test('the light-mode accent is worked out from the accent and passes 4.5:1', async () => {
    const { data, error } = await users.admin.client
      .from('bars')
      .update({ primary_color: '#E4B062' })
      .eq('id', ids.barOne)
      .select('accent_light_color')
      .single();
    assert.ifError(error);
    assert.match(data.accent_light_color, /^#[0-9a-f]{6}$/);
    const { rows } = await db.query("SELECT private.contrast_ratio($1, '#f6f3ee') AS ratio", [data.accent_light_color]);
    assert.ok(rows[0].ratio >= 4.5, `ratio ${rows[0].ratio}`);
  });

  test('a hand-picked light-mode accent that is too light is refused', async () => {
    const { error } = await users.admin.client.from('bars').update({ accent_light_color: '#F0D9A8' }).eq('id', ids.barOne);
    assert.ok(error);
  });

  test('short names over 12 characters and unknown faces are refused', async () => {
    const client = users.admin.client;
    assert.ok((await client.from('bars').update({ short_name: 'Little Rye Bar!' }).eq('id', ids.barOne)).error);
    assert.ok((await client.from('bars').update({ display_face: 'comic_sans' }).eq('id', ids.barOne)).error);
    const ok = await client.from('bars').update({ short_name: 'Little Rye', display_face: 'fraunces' }).eq('id', ids.barOne);
    assert.ifError(ok.error);
  });

  test('only admins change the brand', async () => {
    const { data } = await users.maker.client.from('bars').update({ short_name: 'Hijacked' }).eq('id', ids.barOne).select('id');
    assert.deepEqual(data, []);
  });
});

describe('venue roles', () => {
  test('a member with a role gets its base level, whatever level was written', async () => {
    const { rows } = await db.query(
      'SELECT user_id, role_level FROM public.user_bars WHERE bar_id = $1 AND user_id = ANY($2)',
      [ids.barOne, [users.barback.id, users.headBartender.id, users.guestBartender.id]]
    );
    const levels = Object.fromEntries(rows.map((r) => [r.user_id, r.role_level]));
    assert.equal(levels[users.barback.id], 20);
    assert.equal(levels[users.headBartender.id], 35);
    assert.equal(levels[users.guestBartender.id], 35);
  });

  test('capabilities follow the brief\'s matrix', async () => {
    const caps = async (label) => {
      const { data, error } = await users[label].client.rpc('my_capabilities', { p_bar_id: ids.barOne });
      assert.ifError(error);
      return new Set(data);
    };
    const barback = await caps('barback');
    assert.ok(barback.has('house_made') && barback.has('prep') && barback.has('locations'));
    assert.ok(!barback.has('specs') && !barback.has('edit_drinks'));

    const head = await caps('headBartender');
    assert.ok(head.has('costs') && head.has('edit_drinks'));
    assert.ok(!head.has('staff') && !head.has('publish'));

    const guest = await caps('guestBartender');
    assert.ok(guest.has('edit_drinks') && guest.has('specs'));
    assert.ok(!guest.has('house_made') && !guest.has('prep'));

    assert.deepEqual([...(await caps('guest'))], ['menu']);
    assert.deepEqual([...(await caps('outsider'))], []);
  });

  test('overrides cannot touch what existing policies decide by level', async () => {
    for (const cap of ['edit_drinks', 'specs', 'staff', 'brand', 'menus', 'menu']) {
      const { error } = await users.admin.client
        .from('venue_roles')
        .insert({ bar_id: ids.barOne, name: `Sneaky ${cap}`, base_level: 20, granted: [cap] });
      assert.ok(error, `granting ${cap} should fail`);
    }
  });

  test('admin roles cannot expire', async () => {
    const { error } = await users.admin.client.from('venue_roles').insert({
      bar_id: ids.barOne, name: 'Temp admin', base_level: 40, ends_at: new Date(Date.now() + hour).toISOString(),
    });
    assert.ok(error);
  });

  test('only the bar\'s admins manage roles, and only its members see them', async () => {
    const { error } = await users.maker.client.from('venue_roles').insert({ bar_id: ids.barOne, name: 'Maker made', base_level: 20 });
    assert.ok(error);
    const { error: otherError } = await users.otherAdmin.client
      .from('venue_roles')
      .insert({ bar_id: ids.barOne, name: 'Other admin made', base_level: 20 });
    assert.ok(otherError);

    assert.equal((await visible(users.floor.client, 'venue_roles', 'id', [ids.barbackRole])).size, 1);
    assert.equal((await visible(users.outsider.client, 'venue_roles', 'id', [ids.barbackRole])).size, 0);
  });

  test('a role from another bar cannot be assigned', async () => {
    const { error } = await users.admin.client
      .from('user_bars')
      .update({ venue_role_id: ids.barTwoRole })
      .eq('bar_id', ids.barOne)
      .eq('user_id', users.floor.id);
    assert.ok(error);
  });

  test('changing a role\'s base level moves its members; changing a member\'s level by hand drops the role', async () => {
    const role = (await serviceInsert('venue_roles', { bar_id: ids.barOne, name: `Runner ${run}`, base_level: 20 })).id;
    const member = await makeUser('runner', { signIn: false });
    extraUserIds.push(member.id);
    await serviceInsert('user_bars', { user_id: member.id, bar_id: ids.barOne, role_level: 10, venue_role_id: role });

    const { error } = await users.admin.client.from('venue_roles').update({ base_level: 30 }).eq('id', role);
    assert.ifError(error);
    let { rows } = await db.query('SELECT role_level, venue_role_id FROM public.user_bars WHERE user_id = $1', [member.id]);
    assert.deepEqual(rows[0], { role_level: 30, venue_role_id: role });

    await users.admin.client.from('user_bars').update({ role_level: 35 }).eq('user_id', member.id).eq('bar_id', ids.barOne);
    ({ rows } = await db.query('SELECT role_level, venue_role_id FROM public.user_bars WHERE user_id = $1', [member.id]));
    assert.deepEqual(rows[0], { role_level: 35, venue_role_id: null });
  });

  test('the role matrix lists base levels and custom roles, for members only', async () => {
    const { data, error } = await users.floor.client.rpc('get_venue_role_matrix', { p_bar_id: ids.barOne });
    assert.ifError(error);
    assert.deepEqual(data.filter((r) => r.role_id === null).map((r) => r.base_level), [10, 20, 30, 35, 40]);
    const barback = data.find((r) => r.role_id === ids.barbackRole);
    assert.ok(barback.capabilities.includes('prep'));

    const { data: outsider } = await users.outsider.client.rpc('get_venue_role_matrix', { p_bar_id: ids.barOne });
    assert.deepEqual(outsider, []);
  });

  test('guest staff lose access the moment their role ends', async () => {
    const client = users.expiredGuest.client;
    assert.equal((await visible(client, 'items', 'id', [ids.penicillin])).size, 0);
    assert.deepEqual((await client.rpc('my_capabilities', { p_bar_id: ids.barOne })).data, []);
    assert.deepEqual((await client.rpc('get_my_bars')).data, []);
    // The recipe view runs as its owner and reads user_bars itself.
    assert.equal((await visible(client, 'app_recipe_presentation', 'id', [ids.penicillinRecipe])).size, 0);
    // So does the member list, which also no longer lists them.
    assert.ok((await client.rpc('get_bar_members', { p_bar_id: ids.barOne })).error);
    const { data: roster, error: rosterError } = await users.admin.client.rpc('get_bar_members', { p_bar_id: ids.barOne });
    assert.ifError(rosterError);
    const listed = new Set(roster.map((m) => m.user_id));
    assert.ok(!listed.has(users.expiredGuest.id), 'ended guest is not listed');
    assert.ok(listed.has(users.guestBartender.id), 'current guest is listed');

    await client.from('items').update({ name: 'vandalised' }).eq('id', ids.penicillin);
    const { rows } = await db.query('SELECT name FROM public.items WHERE id = $1', [ids.penicillin]);
    assert.equal(rows[0].name, `Penicillin ${run}`);

    // Guest staff whose role hasn't ended still get in, specs included.
    assert.equal((await visible(users.guestBartender.client, 'items', 'id', [ids.penicillin])).size, 1);
    const { data: spec } = await users.guestBartender.client
      .from('app_recipe_presentation')
      .select('amount')
      .eq('id', ids.penicillinRecipe);
    assert.deepEqual(spec.map((r) => Number(r.amount)), [22.5]);
  });

  test('the sweep removes ended memberships and leaves current ones', async () => {
    await db.query('SELECT private.sweep_expired_memberships()');
    const { rows } = await db.query(
      'SELECT user_id FROM public.user_bars WHERE bar_id = $1 AND user_id = ANY($2)',
      [ids.barOne, [users.expiredGuest.id, users.guestBartender.id]]
    );
    assert.deepEqual(rows.map((r) => r.user_id), [users.guestBartender.id]);
  });
});

describe('back bar', () => {
  test('where things live is visible from Employee up, and never to other bars', async () => {
    for (const label of ['floor', 'barback', 'bartender', 'admin']) {
      assert.equal((await visible(users[label].client, 'bar_zones', 'id', [ids.fridge])).size, 1, label);
      assert.equal((await visible(users[label].client, 'item_locations', 'id', [ids.location])).size, 1, label);
    }
    for (const label of ['guest', 'outsider', 'otherAdmin']) {
      assert.equal((await visible(users[label].client, 'bar_zones', 'id', [ids.fridge])).size, 0, label);
      assert.equal((await visible(users[label].client, 'item_locations', 'id', [ids.location])).size, 0, label);
    }
  });

  test('Drink Creators draw the plan; the floor and barbacks cannot', async () => {
    for (const label of ['floor', 'barback']) {
      const { error } = await users[label].client.from('bar_zones').insert({ bar_id: ids.barOne, name: `By ${label}` });
      assert.ok(error, label);
    }
    const { error } = await users.maker.client
      .from('bar_zones')
      .insert({ bar_id: ids.barOne, name: 'Speed rail', kind: 'speed_rail', plan_x: 0.05, plan_y: 0.6, plan_w: 0.3, plan_h: 0.1 });
    assert.ifError(error);
  });

  test('zones stay on the plan', async () => {
    const { error } = await users.maker.client
      .from('bar_zones')
      .insert({ bar_id: ids.barOne, name: 'Off the edge', plan_x: 0.9, plan_y: 0, plan_w: 0.2, plan_h: 0.1 });
    assert.ok(error);
  });

  test('a barback places items; nobody places another bar\'s items or uses its zones', async () => {
    const barback = users.barback.client;
    const { error } = await barback
      .from('item_locations')
      .insert({ bar_id: ids.barOne, item_id: ids.scotch, zone_id: ids.fridge, container: '700 ml bottle' });
    assert.ifError(error);

    const otherItem = await users.admin.client
      .from('item_locations')
      .insert({ bar_id: ids.barOne, item_id: ids.barTwoDrink, zone_id: ids.fridge });
    assert.ok(otherItem.error);

    const otherZone = await users.admin.client
      .from('item_locations')
      .insert({ bar_id: ids.barOne, item_id: ids.scotch, zone_id: ids.barTwoZone });
    assert.ok(otherZone.error);

    const floor = await users.floor.client.from('item_locations').insert({ bar_id: ids.barOne, item_id: ids.scotch, zone_id: ids.fridge });
    assert.ok(floor.error);
  });
});

describe('prep and purchasing', () => {
  test('house-made prep is visible to house-made readers and the prep crew only', async () => {
    for (const label of ['barback', 'maker', 'admin']) {
      assert.equal((await visible(users[label].client, 'item_prep', 'item_id', [ids.syrup])).size, 1, label);
    }
    for (const label of ['bartender', 'floor', 'guestBartender', 'outsider']) {
      assert.equal((await visible(users[label].client, 'item_prep', 'item_id', [ids.syrup])).size, 0, label);
    }
  });

  test('the prep crew can set par; the floor cannot', async () => {
    const { data } = await users.barback.client
      .from('item_prep')
      .update({ par_amount: 3 })
      .eq('item_id', ids.syrup)
      .select('par_amount');
    assert.equal(Number(data[0].par_amount), 3);

    const { data: floor } = await users.floor.client.from('item_prep').update({ par_amount: 99 }).eq('item_id', ids.syrup).select('item_id');
    assert.deepEqual(floor, []);
  });

  test('suppliers and pack sizes are for the prep crew and cost handlers', async () => {
    for (const label of ['barback', 'maker', 'headBartender', 'admin']) {
      assert.equal((await visible(users[label].client, 'item_purchasing', 'item_id', [ids.scotch])).size, 1, label);
      assert.equal((await visible(users[label].client, 'suppliers', 'id', [ids.supplier])).size, 1, label);
    }
    for (const label of ['bartender', 'guestBartender', 'outsider']) {
      assert.equal((await visible(users[label].client, 'item_purchasing', 'item_id', [ids.scotch])).size, 0, label);
      assert.equal((await visible(users[label].client, 'suppliers', 'id', [ids.supplier])).size, 0, label);
    }
  });

  test('costs are for admins and roles granted costs only', async () => {
    for (const label of ['headBartender', 'admin']) {
      assert.equal((await visible(users[label].client, 'item_costs', 'item_id', [ids.scotch])).size, 1, label);
    }
    for (const label of ['maker', 'barback', 'bartender', 'otherAdmin']) {
      assert.equal((await visible(users[label].client, 'item_costs', 'item_id', [ids.scotch])).size, 0, label);
    }
    const { error } = await users.maker.client
      .from('item_costs')
      .insert({ bar_id: ids.barOne, item_id: ids.martini, pack_cost_minor: 1, currency: 'AUD' });
    assert.ok(error);
  });
});

describe('profiles and credit', () => {
  test('signed-out visitors read public profiles and nothing else', async () => {
    const { data } = await anon.from('profiles').select('id').in('id', [ids.samProfile, ids.privateProfile, ids.barThreeProfile]);
    assert.deepEqual(data.map((r) => r.id), [ids.samProfile]);
  });

  test('owners and bar members see their own private profile', async () => {
    assert.equal((await visible(users.homeUser.client, 'profiles', 'id', [ids.privateProfile])).size, 1);
    assert.equal((await visible(users.otherAdmin.client, 'profiles', 'id', [ids.barThreeProfile])).size, 1);
    assert.equal((await visible(users.outsider.client, 'profiles', 'id', [ids.privateProfile, ids.barThreeProfile])).size, 0);
  });

  test('people make only their own profile; unclaimed profiles are for moderators', async () => {
    const client = users.outsider.client;
    const own = await client.from('profiles').insert({ kind: 'person', handle: `out${run}`, display_name: 'Me', user_id: users.outsider.id });
    assert.ifError(own.error);
    const forSomeoneElse = await client
      .from('profiles')
      .insert({ kind: 'person', handle: `fake${run}`, display_name: 'Not me', user_id: users.homeUser.id });
    assert.ok(forSomeoneElse.error);
    const unclaimed = await client.from('profiles').insert({ kind: 'person', handle: `hist${run}`, display_name: 'A legend' });
    assert.ok(unclaimed.error);
    const person = await client.from('profiles').update({ address_line: '1 Home St' }).eq('user_id', users.outsider.id);
    assert.ok(person.error, 'a person profile cannot hold an address');
  });

  test('only members who can publish edit a bar\'s profile', async () => {
    const { data } = await users.maker.client.from('profiles').update({ bio: 'hijacked' }).eq('id', ids.barOneProfile).select('id');
    assert.deepEqual(data, []);
    const { data: admin } = await users.admin.client.from('profiles').update({ bio: 'Rye and amaro.' }).eq('id', ids.barOneProfile).select('id');
    assert.equal(admin.length, 1);
  });

  test('credit starts as suggested and only moderators verify it', async () => {
    const maker = users.maker.client;
    const { data, error } = await maker
      .from('items')
      .update({ creator_profile_id: ids.samProfile, origin_bar_profile_id: ids.barOneProfile, origin_year: 2005 })
      .eq('id', ids.penicillin)
      .select('credit_status')
      .single();
    assert.ifError(error);
    assert.equal(data.credit_status, 'suggested');

    assert.ok((await maker.from('items').update({ credit_status: 'verified' }).eq('id', ids.penicillin)).error);

    const verified = await users.catalogAdmin.client.from('items').update({ credit_status: 'verified' }).eq('id', ids.penicillin);
    assert.ifError(verified.error);

    // Swapping the creator on a verified credit drops it back to suggested.
    const other = (await serviceInsert('profiles', { kind: 'person', handle: `other${run}`, display_name: 'Other' })).id;
    const { data: swapped } = await maker
      .from('items')
      .update({ creator_profile_id: other })
      .eq('id', ids.penicillin)
      .select('credit_status')
      .single();
    assert.equal(swapped.credit_status, 'suggested');
  });

  test('a bar claims credit for its own drinks, not other bars\'', async () => {
    const maker = users.maker.client;
    const own = await maker
      .from('items')
      .update({ origin_bar_profile_id: ids.barOneProfile, credit_status: 'claimed' })
      .eq('id', ids.penicillin);
    assert.ifError(own.error);
    const other = await maker
      .from('items')
      .update({ origin_bar_profile_id: ids.barTwoProfile, creator_profile_id: null, credit_status: 'claimed' })
      .eq('id', ids.penicillin);
    assert.ok(other.error);
  });

  test('the creator must be a person and the origin a bar', async () => {
    const maker = users.maker.client;
    assert.ok((await maker.from('items').update({ creator_profile_id: ids.barOneProfile }).eq('id', ids.penicillin)).error);
    assert.ok((await maker.from('items').update({ origin_bar_profile_id: ids.samProfile }).eq('id', ids.penicillin)).error);
  });

  test('someone claims a historic profile and a moderator approves it', async () => {
    const claimant = await makeUser('claimant');
    extraUserIds.push(claimant.id);
    const { data: claim, error } = await claimant.client
      .from('profile_claims')
      .insert({ profile_id: ids.samProfile, message: 'It me' })
      .select('id')
      .single();
    assert.ifError(error);

    assert.ok((await claimant.client.rpc('approve_profile_claim', { p_claim_id: claim.id })).error);
    assert.ok((await claimant.client.from('profile_claims').update({ status: 'approved' }).eq('id', claim.id).select('id')).data?.length !== 1);

    const { data: profile, error: approveError } = await users.catalogAdmin.client.rpc('approve_profile_claim', { p_claim_id: claim.id });
    assert.ifError(approveError);
    assert.equal(profile.user_id, claimant.id);

    // A claimed profile can't be claimed again.
    const again = await users.outsider.client.from('profile_claims').insert({ profile_id: ids.samProfile });
    assert.ok(again.error);
  });
});

describe('events', () => {
  test('menu builders create takeovers on their own menus only', async () => {
    const start = new Date(Date.now() + 7 * 24 * hour);
    const row = {
      bar_id: ids.barOne, name: `Pale Moth x Little Rye ${run}`, starts_at: start.toISOString(),
      menu_id: ids.barOneMenu, guest_profile_id: ids.barTwoProfile, guest_role_id: ids.guestRole, covers_estimate: 140,
    };
    assert.ok((await users.bartender.client.from('events').insert(row)).error);
    assert.ok((await users.maker.client.from('events').insert({ ...row, menu_id: ids.barTwoMenu })).error);
    assert.ok((await users.maker.client.from('events').insert({ ...row, guest_profile_id: ids.samProfile })).error);

    const { data, error } = await users.maker.client.from('events').insert(row).select('id').single();
    assert.ifError(error);
    ids.event = data.id;
  });

  test('the host\'s members and the guest venue see the event; others do not', async () => {
    for (const label of ['guest', 'maker', 'otherAdmin']) {
      assert.equal((await visible(users[label].client, 'events', 'id', [ids.event])).size, 1, label);
    }
    assert.equal((await visible(users.outsider.client, 'events', 'id', [ids.event])).size, 0);
    // The guest venue sees the event, not the host's menu.
    assert.equal((await visible(users.otherAdmin.client, 'menus', 'id', [ids.barOneMenu])).size, 0);
  });
});

describe('home bar and rankings', () => {
  test('a shelf is private to its owner', async () => {
    const { error } = await users.homeUser.client.from('home_bar_items').insert({ item_id: ids.scotch });
    assert.ifError(error);
    assert.equal((await visible(users.outsider.client, 'home_bar_items', 'item_id', [ids.scotch])).size, 0);
    assert.ok((await users.homeUser.client.from('home_bar_items').insert({ item_id: ids.barTwoDrink })).error, 'hidden items cannot be shelved');
  });

  test('rankings are private, and comparisons stay within one person\'s list', async () => {
    const home = users.homeUser.client;
    const entry = async (client, venue, key) => {
      const { data, error } = await client
        .from('rank_entries')
        .insert({ item_id: ids.martini, ranked_as_item_id: ids.martini, venue_profile_id: venue, sentiment: 'loved', rank_key: key })
        .select('id')
        .single();
      assert.ifError(error);
      return data.id;
    };
    const atRye = await entry(home, ids.barOneProfile, 1);
    const atHome = await entry(home, null, 2);
    const outsiders = await entry(users.outsider.client, ids.barOneProfile, 1);

    assert.ok((await home.from('rank_entries').insert({
      item_id: ids.martini, ranked_as_item_id: ids.martini, venue_profile_id: ids.barThreeProfile, sentiment: 'fine', rank_key: 1,
    })).error, 'only public bars can be ranked');

    assert.equal((await visible(users.outsider.client, 'rank_entries', 'id', [atRye, atHome])).size, 0);
    assert.ifError((await home.from('rank_comparisons').insert({ winner_entry_id: atRye, loser_entry_id: atHome })).error);
    assert.ok((await home.from('rank_comparisons').insert({ winner_entry_id: atRye, loser_entry_id: outsiders })).error);

    const { data: scores } = await home.from('rank_entry_scores').select('id, score').order('rank_key');
    assert.deepEqual(scores.map((s) => Number(s.score)), [10, 8.4]);
  });

  test('a drink at a bar is ranked only once enough people outside the bar rank it', async () => {
    // Fixtures written straight to the table: this checks the aggregation,
    // the policies are covered above.
    const rankers = [];
    for (let i = 0; i < 19; i++) rankers.push((await makeUser(`ranker${i}`, { signIn: false })).id);
    extraUserIds.push(...rankers);
    const addEntry = (userId) =>
      db.query(
        `INSERT INTO public.rank_entries (user_id, item_id, ranked_as_item_id, venue_profile_id, sentiment, rank_key)
         VALUES ($1, $2, $2, $3, 'loved', 1)`,
        [userId, ids.martini, ids.barOneProfile]
      );
    for (const id of rankers) await addEntry(id);
    // Staff ranking their own bar don't count.
    await addEntry(users.bartender.id);

    const rankings = async () => {
      await db.query('SELECT private.refresh_rankings()');
      const { data, error } = await anon.rpc('get_drink_rankings', { p_ranked_as_item_id: ids.martini, p_city: 'melbourne' });
      assert.ifError(error);
      return data;
    };

    // homeUser + outsider (above) + 19 = 21 rankers, minus nobody: shown.
    // Remove two to fall below the minimum of 20 first.
    await db.query('DELETE FROM public.rank_entries WHERE user_id = ANY($1)', [[users.homeUser.id, users.outsider.id]]);
    assert.deepEqual(await rankings(), []);

    await addEntry(users.homeUser.id);
    const shown = await rankings();
    assert.equal(shown.length, 1);
    assert.equal(shown[0].venue_profile_id, ids.barOneProfile);
    assert.equal(shown[0].rankers, 20);
    assert.equal(Number(shown[0].score), 10);

    const { data: elsewhere } = await anon.rpc('get_drink_rankings', { p_ranked_as_item_id: ids.martini, p_country_code: 'NZ' });
    assert.deepEqual(elsewhere, []);
  });

  test('signed-out visitors cannot read anyone\'s ranking rows', async () => {
    const { data } = await anon.from('rank_entries').select('id').eq('item_id', ids.martini);
    assert.deepEqual(data ?? [], []);
  });
});
