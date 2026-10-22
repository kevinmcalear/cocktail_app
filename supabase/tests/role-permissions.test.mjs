// Tap a dot to change what a role can do
// (supabase/migrations/20261101200000_role_permissions_per_role.sql).
//
// Every permission is per role now: a venue role or a venue's change to a
// built-in role grants or takes it away, and the policies follow. An Admin
// always keeps invite and manage staff, a takeover role grants nothing after
// its end date, and only people with staff change roles (someone with staff
// who isn't an Admin can't touch Admins or hand out more than they have).
// Runs through the real API as real users, against the local stack only:
//
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
  throw new Error(`Refusing to run role permission tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const users = {};
const ids = {};
const hour = 60 * 60 * 1000;

async function makeUser(label) {
  const email = `${label}-${run}@security-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, email, client };
}

async function serviceInsert(table, row) {
  const { data, error } = await service.from(table).insert(row).select().single();
  if (error) throw new Error(`fixture insert into ${table} failed: ${error.message}`);
  return data;
}

const caps = async (label) => {
  const { data, error } = await users[label].client.rpc('my_capabilities', { p_bar_id: ids.bar });
  assert.ifError(error);
  return new Set(data);
};

const setCap = (label, { level = null, roleId = null }, capability, on) =>
  users[label].client.rpc('set_role_capability', {
    p_bar_id: ids.bar, p_role_id: roleId, p_level: level, p_capability: capability, p_on: on,
  });

const resetLevels = () => db.query('DELETE FROM public.venue_level_overrides WHERE bar_id = $1', [ids.bar]);

async function amountsSeen(label) {
  const { data, error } = await users[label].client
    .from('app_recipe_presentation')
    .select('amount')
    .eq('recipe_item_id', ids.drink);
  assert.ifError(error);
  return data.map((r) => r.amount);
}

async function seesDrink(label) {
  const { data, error } = await users[label].client.from('items').select('id').eq('id', ids.drink);
  assert.ifError(error);
  return data.length === 1;
}

before(async () => {
  await db.connect();
  for (const label of ['admin', 'head', 'maker', 'floor', 'guest', 'takeover', 'outsider', 'newcomer']) {
    users[label] = await makeUser(label);
  }

  ids.bar = (await serviceInsert('bars', { name: `Little Rye ${run}` })).id;
  ids.otherBar = (await serviceInsert('bars', { name: `Pale Moth ${run}` })).id;

  // A ready-made Head bartender: Drink Creator plus staff and publishing.
  ids.headRole = (
    await serviceInsert('venue_roles', { bar_id: ids.bar, name: 'Head bartender', base_level: 35, granted: ['staff', 'publish'] })
  ).id;
  // A takeover bartender whose night is over: menus and specs, ended an hour ago.
  ids.endedRole = (
    await serviceInsert('venue_roles', {
      bar_id: ids.bar, name: 'Takeover bartender', base_level: 30, granted: ['menus'], revoked: ['talking_points', 'photos'],
      ends_at: new Date(Date.now() - hour).toISOString(),
    })
  ).id;

  for (const [label, level, role] of [
    ['admin', 40], ['head', 35, ids.headRole], ['maker', 35], ['floor', 20], ['guest', 10], ['takeover', 30, ids.endedRole],
  ]) {
    await serviceInsert('user_bars', { user_id: users[label].id, bar_id: ids.bar, role_level: level, venue_role_id: role ?? null });
  }
  await serviceInsert('user_bars', { user_id: users.outsider.id, bar_id: ids.otherBar, role_level: 40 });

  ids.syrup = (await serviceInsert('items', { name: `Honey syrup ${run}`, item_type: 'ingredient', bar_id: ids.bar })).id;
  ids.drink = (await serviceInsert('items', { name: `Penicillin ${run}`, item_type: 'cocktail', bar_id: ids.bar })).id;
  await serviceInsert('recipes', { recipe_item_id: ids.drink, ingredient_item_id: ids.syrup, amount: 22.5, unit: 'ml', sort_order: 0 });
});

after(async () => {
  const like = `%${run}%`;
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.menus WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('a changed permission grants and revokes access', () => {
  test('nothing changes until someone taps: built-in roles keep their access', async () => {
    const { data, error } = await users.floor.client.rpc('get_venue_role_matrix', { p_bar_id: ids.bar });
    assert.ifError(error);
    for (const row of data.filter((r) => r.role_id === null)) {
      assert.deepEqual(row.capabilities, row.starts_with, `level ${row.base_level} starts unchanged`);
      assert.deepEqual([row.granted, row.revoked], [[], []]);
    }
    assert.ok(!(await caps('floor')).has('specs'));
    assert.deepEqual(await amountsSeen('floor'), [null]);
  });

  test('specs granted to Employee here shows the amounts, and taking it back hides them', async () => {
    try {
      assert.ifError((await setCap('admin', { level: 20 }, 'specs', true)).error);
      assert.ok((await caps('floor')).has('specs'));
      assert.deepEqual(await amountsSeen('floor'), [22.5]);

      const { data } = await users.floor.client.rpc('get_venue_role_matrix', { p_bar_id: ids.bar });
      const employee = data.find((r) => r.role_id === null && r.base_level === 20);
      assert.deepEqual(employee.granted, ['specs']);
      assert.ok(employee.capabilities.includes('specs') && !employee.starts_with.includes('specs'));

      assert.ifError((await setCap('admin', { level: 20 }, 'specs', false)).error);
      assert.ok(!(await caps('floor')).has('specs'));
      assert.deepEqual(await amountsSeen('floor'), [null]);
    } finally {
      await resetLevels();
    }
  });

  test('create and edit drinks taken from Drink Creator stops edits; Reset to built in brings them back', async () => {
    try {
      assert.ifError((await setCap('admin', { level: 35 }, 'edit_drinks', false)).error);
      const { data: refused } = await users.maker.client.from('items').update({ description: 'no' }).eq('id', ids.drink).select('id');
      assert.deepEqual(refused, []);
      const { error: insertError } = await users.maker.client
        .from('items')
        .insert({ name: `Maker made ${run}`, item_type: 'cocktail', bar_id: ids.bar, created_by: users.maker.id });
      assert.ok(insertError, 'a Drink Creator without edit_drinks cannot add a bar drink');

      // The venue role built on Drink Creator keeps its own permissions.
      assert.ok((await caps('head')).has('edit_drinks'));

      const { error: resetError } = await users.admin.client
        .from('venue_level_overrides')
        .delete()
        .eq('bar_id', ids.bar)
        .eq('base_level', 35);
      assert.ifError(resetError);
      const { data: allowed } = await users.maker.client.from('items').update({ description: 'yes' }).eq('id', ids.drink).select('id');
      assert.equal(allowed.length, 1);
    } finally {
      await resetLevels();
    }
  });

  test('build menus taken from Drink Creator stops it making the bar\'s menus', async () => {
    try {
      assert.ifError((await setCap('admin', { level: 35 }, 'menus', false)).error);
      const { error } = await users.maker.client
        .from('menus')
        .insert({ name: `Spring ${run}`, bar_id: ids.bar, created_by: users.maker.id });
      assert.ok(error);
      await resetLevels();
      const { error: againError } = await users.maker.client
        .from('menus')
        .insert({ name: `Spring ${run}`, bar_id: ids.bar, created_by: users.maker.id });
      assert.ifError(againError);
    } finally {
      await resetLevels();
    }
  });

  test('menu taken from Guest hides the bar\'s drinks; given back, they show', async () => {
    try {
      assert.ok(await seesDrink('guest'));
      assert.ifError((await setCap('admin', { level: 10 }, 'menu', false)).error);
      assert.ok(!(await seesDrink('guest')));
      assert.ifError((await setCap('admin', { level: 10 }, 'menu', true)).error);
      assert.ok(await seesDrink('guest'));
    } finally {
      await resetLevels();
    }
  });

  test('edit brand given to a role lets it change the brand, and nothing else about the venue', async () => {
    try {
      assert.ifError((await setCap('admin', { level: 35 }, 'brand', true)).error);
      const { data: brand, error } = await users.maker.client
        .from('bars').update({ primary_color: '#336699' }).eq('id', ids.bar).select('primary_color');
      assert.ifError(error);
      assert.equal(brand[0].primary_color, '#336699');
      const { error: nameError } = await users.maker.client.from('bars').update({ name: `Renamed ${run}` }).eq('id', ids.bar);
      assert.match(nameError?.message ?? '', /Only an Admin can change the venue/);

      // An Admin without brand can't change it either.
      assert.ifError((await setCap('admin', { level: 40 }, 'brand', false)).error);
      const { error: adminError } = await users.admin.client.from('bars').update({ primary_color: '#E4B062' }).eq('id', ids.bar);
      assert.ok(adminError);
    } finally {
      await resetLevels();
    }
  });
});

describe('an Admin always keeps invite and manage staff', () => {
  test('the Admin built-in role, and Admin venue roles, refuse to give it up', async () => {
    const { error } = await setCap('admin', { level: 40 }, 'staff', false);
    assert.match(error?.message ?? '', /admin_keeps_staff/);
    const { error: direct } = await users.admin.client
      .from('venue_level_overrides')
      .insert({ bar_id: ids.bar, base_level: 40, revoked: ['staff'] });
    assert.ok(direct);
    const { error: role } = await users.admin.client
      .from('venue_roles')
      .insert({ bar_id: ids.bar, name: 'Quiet admin', base_level: 40, revoked: ['staff'] });
    assert.ok(role);
    assert.ok((await caps('admin')).has('staff'));
  });

  test('even with every other permission taken away, an Admin can still change roles', async () => {
    try {
      for (const cap of ['menu', 'specs', 'edit_drinks', 'menus', 'brand', 'publish']) {
        assert.ifError((await setCap('admin', { level: 40 }, cap, false)).error);
      }
      assert.ok((await caps('admin')).has('staff'));
      assert.ifError((await setCap('admin', { level: 40 }, 'brand', true)).error);
    } finally {
      await resetLevels();
    }
  });
});

describe('a takeover role ends', () => {
  test('after its end date it grants nothing, whatever it granted', async () => {
    assert.deepEqual([...(await caps('takeover'))], []);
    assert.ok(!(await seesDrink('takeover')));
    const { error } = await users.takeover.client
      .from('menus')
      .insert({ name: `After hours ${run}`, bar_id: ids.bar, created_by: users.takeover.id });
    assert.ok(error);
  });

  test('before its end date it has exactly what it was given', async () => {
    const role = (
      await serviceInsert('venue_roles', {
        bar_id: ids.bar, name: `Guest shift ${run}`, base_level: 30, revoked: ['talking_points', 'photos'],
        ends_at: new Date(Date.now() + 24 * hour).toISOString(),
      })
    ).id;
    await db.query('UPDATE public.user_bars SET venue_role_id = $1 WHERE user_id = $2 AND bar_id = $3', [role, users.takeover.id, ids.bar]);
    try {
      assert.deepEqual([...(await caps('takeover'))].sort(), ['locations', 'menu', 'specs']);
      assert.deepEqual(await amountsSeen('takeover'), [22.5]);
    } finally {
      await db.query('UPDATE public.user_bars SET venue_role_id = $1 WHERE user_id = $2 AND bar_id = $3', [ids.endedRole, users.takeover.id, ids.bar]);
      await db.query('DELETE FROM public.venue_roles WHERE id = $1', [role]);
    }
  });
});

describe('only people who can manage staff change roles', () => {
  test('a member without staff, and someone from another bar, can\'t change a role', async () => {
    for (const label of ['floor', 'maker', 'outsider']) {
      const { error } = await setCap(label, { level: 20 }, 'costs', true);
      assert.ok(error, `${label} cannot change a built-in role`);
      const { error: roleError } = await setCap(label, { roleId: ids.headRole }, 'brand', true);
      assert.ok(roleError, `${label} cannot change a venue role`);
      const { error: insertError } = await users[label].client
        .from('venue_level_overrides')
        .insert({ bar_id: ids.bar, base_level: 20, granted: ['costs'] });
      assert.ok(insertError);
      const { data: updated } = await users[label].client
        .from('venue_roles').update({ granted: ['brand', 'staff'] }).eq('id', ids.headRole).select('id');
      assert.deepEqual(updated ?? [], []);
      const { data: members } = await users[label].client
        .from('user_bars').update({ role_level: 40 }).eq('bar_id', ids.bar).eq('user_id', users[label].id).select('user_id');
      assert.deepEqual(members ?? [], []);
    }
    const { rows } = await db.query('SELECT count(*)::int AS n FROM public.venue_level_overrides WHERE bar_id = $1', [ids.bar]);
    assert.equal(rows[0].n, 0);
    const { rows: head } = await db.query('SELECT granted FROM public.venue_roles WHERE id = $1', [ids.headRole]);
    assert.deepEqual(head[0].granted.replace(/[{}]/g, '').split(',').sort(), ['publish', 'staff']);
  });

  test('a Head bartender with staff changes roles, but only within what they can do and never an Admin', async () => {
    try {
      // Within their own permissions: fine.
      assert.ifError((await setCap('head', { level: 20 }, 'specs', true)).error);
      assert.ok((await caps('floor')).has('specs'));
      // Brand is something they don't have.
      const brandTry = await setCap('head', { level: 20 }, 'brand', true);
      assert.match(brandTry.error?.message ?? '', /what you can do yourself/);
      // The Admin role is out of reach.
      assert.match((await setCap('head', { level: 40 }, 'publish', false)).error?.message ?? '', /Only an Admin/);
      // They can't make anyone an Admin, or move an Admin.
      const { error: promote } = await users.head.client
        .from('user_bars').update({ role_level: 40 }).eq('bar_id', ids.bar).eq('user_id', users.floor.id);
      assert.match(promote?.message ?? '', /Only an Admin/);
      const { error: demote } = await users.head.client
        .from('user_bars').update({ role_level: 20 }).eq('bar_id', ids.bar).eq('user_id', users.admin.id);
      assert.match(demote?.message ?? '', /Only an Admin/);
      // They can move a member to a role no bigger than theirs.
      const { error: move } = await users.head.client
        .from('user_bars').update({ role_level: 30 }).eq('bar_id', ids.bar).eq('user_id', users.floor.id);
      assert.ifError(move);
      // Invites: an Employee yes, an Admin no.
      const { error: invite } = await users.head.client
        .rpc('add_user_to_bar_by_email', { p_email: users.newcomer.email, p_bar_id: ids.bar, p_role_level: 20 });
      assert.ifError(invite);
      const { error: inviteAdmin } = await users.head.client
        .rpc('add_user_to_bar_by_email', { p_email: users.newcomer.email, p_bar_id: ids.bar, p_role_level: 40 });
      assert.match(inviteAdmin?.message ?? '', /Only an Admin can invite/);
      // They see the team's emails, as Admins do.
      const { data: members, error } = await users.head.client.rpc('get_bar_members', { p_bar_id: ids.bar });
      assert.ifError(error);
      assert.ok(members.find((m) => m.user_id === users.floor.id).email);
    } finally {
      await resetLevels();
      await db.query('UPDATE public.user_bars SET role_level = 20 WHERE user_id = $1 AND bar_id = $2', [users.floor.id, ids.bar]);
      await db.query('DELETE FROM public.bar_invites WHERE bar_id = $1', [ids.bar]);
    }
  });

  test('nobody with staff gives themselves more; an Admin can still step down, and an invite still decides the role', async () => {
    // The Head bartender can't make their own row a bigger role.
    const { error: self } = await users.head.client
      .from('user_bars').update({ role_level: 40, venue_role_id: null }).eq('bar_id', ids.bar).eq('user_id', users.head.id);
    assert.match(self?.message ?? '', /Only an Admin/);
    const bigger = (
      await serviceInsert('venue_roles', { bar_id: ids.bar, name: `Brand lead ${run}`, base_level: 35, granted: ['staff', 'publish', 'brand'] })
    ).id;
    try {
      const { error: selfRole } = await users.head.client
        .from('user_bars').update({ venue_role_id: bigger }).eq('bar_id', ids.bar).eq('user_id', users.head.id);
      assert.match(selfRole?.message ?? '', /no more than yours/);
    } finally {
      await db.query('DELETE FROM public.venue_roles WHERE id = $1', [bigger]);
    }

    // A second Admin steps down to Drink Creator.
    const second = await makeUser('second');
    users.second = second;
    await serviceInsert('user_bars', { user_id: second.id, bar_id: ids.bar, role_level: 40 });
    const { error: stepDown } = await second.client
      .from('user_bars').update({ role_level: 35 }).eq('bar_id', ids.bar).eq('user_id', second.id);
    assert.ifError(stepDown);

    // An Admin's invite to Admin, accepted by someone already on the team.
    const { error: invite } = await users.admin.client
      .rpc('add_user_to_bar_by_email', { p_email: second.email, p_bar_id: ids.bar, p_role_level: 40 });
    assert.ifError(invite);
    const { rows } = await db.query('SELECT role_level FROM public.user_bars WHERE user_id = $1 AND bar_id = $2', [second.id, ids.bar]);
    assert.equal(rows[0].role_level, 40, 'a current member gets the new role straight away');
    await db.query('UPDATE public.user_bars SET role_level = 30 WHERE user_id = $1 AND bar_id = $2', [second.id, ids.bar]);
    await serviceInsert('bar_invites', { bar_id: ids.bar, email: second.email, role_level: 40, invited_by: users.admin.id });
    const { error: accept } = await second.client.rpc('accept_bar_invite', { p_bar_id: ids.bar });
    assert.ifError(accept);
    const { rows: after } = await db.query('SELECT role_level FROM public.user_bars WHERE user_id = $1 AND bar_id = $2', [second.id, ids.bar]);
    assert.equal(after[0].role_level, 40);
  });

  test('a member whose staff is taken away loses it at once', async () => {
    try {
      assert.ifError((await setCap('admin', { roleId: ids.headRole }, 'staff', false)).error);
      assert.ok(!(await caps('head')).has('staff'));
      assert.ok((await setCap('head', { level: 20 }, 'specs', true)).error);
    } finally {
      await db.query("UPDATE public.venue_roles SET granted = '{staff,publish}', revoked = '{}' WHERE id = $1", [ids.headRole]);
    }
  });
});
