// Sharing a home menu (supabase/migrations/20260930930000_share_home_menus.sql).
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
  throw new Error(`Refusing to run shared menu tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const users = {};
const ids = { items: {} };

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

const read = async (client, menuId = ids.homeMenu) => {
  const { data, error } = await client.rpc('shared_menu', { p_menu_id: menuId });
  assert.ifError(error);
  return data;
};

const share = (client, menuId, on) =>
  client.from('menus').update({ shared_at: on ? '2001-01-01T00:00:00Z' : null }).eq('id', menuId).select('shared_at');

before(async () => {
  await db.connect();
  for (const label of ['owner', 'noProfile', 'stranger', 'barAdmin']) users[label] = await makeUser(label);

  // A bar that publishes everything with its spec, and the owner's public profile.
  ids.bar = (await serviceInsert('bars', { name: `Open Bar ${run}` })).id;
  await serviceInsert('user_bars', { user_id: users.barAdmin.id, bar_id: ids.bar, role_level: 40 });
  await serviceInsert('profiles', { kind: 'bar', handle: `bar${run}`, display_name: `Open Bar ${run}`, bar_id: ids.bar, is_public: true });
  ids.ownerProfile = (await serviceInsert('profiles', { kind: 'person', handle: `owner${run}`, display_name: `Owner ${run}`, user_id: users.owner.id, is_public: true })).id;
  await db.query("UPDATE public.bars SET default_publish_mode = 'spec' WHERE id = $1", [ids.bar]);

  const item = async (row) => (await serviceInsert('items', row)).id;
  ids.items.barDrink = await item({ name: `Bar Fizz ${run}`, item_type: 'cocktail', bar_id: ids.bar });
  ids.items.ownPublished = await item({ name: `Porch Sour ${run}`, item_type: 'cocktail', created_by: users.owner.id, publish_mode: 'description' });
  ids.items.ownPrivate = await item({ name: `Secret Kitchen Negroni ${run}`, item_type: 'cocktail', created_by: users.owner.id });

  // The owner builds the menu through the app's own path.
  const menu = await users.owner.client.from('menus').insert({ name: `Saturday at home ${run}`, bar_id: null }).select('id').single();
  assert.ifError(menu.error);
  ids.homeMenu = menu.data.id;
  const saved = await users.owner.client.rpc('save_menu', {
    p_menu_id: ids.homeMenu,
    p_name: `Saturday at home ${run}`,
    p_cover_url: null,
    p_cover_position: 50,
    p_sections: [
      { name: 'Stirred', item_ids: [ids.items.ownPrivate, ids.items.barDrink] },
      { name: 'Sours', item_ids: [ids.items.ownPublished] },
    ],
  });
  assert.ifError(saved.error);

  ids.barMenu = (await serviceInsert('menus', { name: `Bar menu ${run}`, bar_id: ids.bar })).id;
  const noProfileMenu = await users.noProfile.client.from('menus').insert({ name: `No profile ${run}`, bar_id: null }).select('id').single();
  assert.ifError(noProfileMenu.error);
  ids.noProfileMenu = noProfileMenu.data.id;
});

after(async () => {
  const like = `%${run}%`;
  await db.query('DELETE FROM public.menus WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.profiles WHERE handle LIKE $1', [like]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('sharing a home menu', () => {
  test('an unshared home menu is invisible to anon and to other people', async () => {
    assert.equal(await read(anon), null);
    assert.equal(await read(users.stranger.client), null);
    for (const [table, column] of [['menus', 'id'], ['menu_drinks', 'menu_id'], ['menu_sections', 'menu_id']]) {
      const { data } = await anon.from(table).select('*').eq(column, ids.homeMenu);
      assert.deepEqual(data ?? [], [], `anon reads no ${table}`);
      const strangers = await users.stranger.client.from(table).select('*').eq(column, ids.homeMenu);
      assert.deepEqual(strangers.data ?? [], [], `a stranger reads no ${table}`);
    }
  });

  test('only the owner can share it, and only with a public profile', async () => {
    const byStranger = await share(users.stranger.client, ids.homeMenu, true);
    assert.deepEqual(byStranger.data ?? [], []);
    assert.equal(await read(anon), null);

    const noProfile = await share(users.noProfile.client, ids.noProfileMenu, true);
    assert.match(noProfile.error?.message ?? '', /public profile/);
  });

  test('a bar menu cannot be shared this way (bars publish with publish_mode)', async () => {
    const res = await share(users.barAdmin.client, ids.barMenu, true);
    assert.ifError(res.error);
    assert.equal(res.data[0].shared_at, null);
    assert.equal(await read(anon, ids.barMenu), null);
  });

  test('the owner shares it; the time is the server’s', async () => {
    const res = await share(users.owner.client, ids.homeMenu, true);
    assert.ifError(res.error);
    assert.ok(Date.now() - new Date(res.data[0].shared_at).getTime() < 60_000);
  });

  test('a shared menu shows public drinks by id and every other entry as a blank placeholder', async () => {
    const menu = await read(anon);
    assert.equal(menu.name, `Saturday at home ${run}`);
    assert.deepEqual(menu.owner, { profile_id: ids.ownerProfile, name: `Owner ${run}`, handle: `owner${run}` });
    assert.deepEqual(
      menu.sections.map((s) => [s.name, s.item_ids]),
      [['Stirred', [null, ids.items.barDrink]], ['Sours', [ids.items.ownPublished]]]
    );
    const text = JSON.stringify(menu);
    assert.ok(!text.includes(ids.items.ownPrivate), 'no private drink id');
    assert.ok(!text.includes('Secret Kitchen'), 'no private drink name');
    assert.ok(!('created_by' in menu) && !text.includes(users.owner.id), 'no owner user id');
  });

  test('sharing changes no drink’s visibility', async () => {
    const pub = await anon.from('published_items').select('id').eq('id', ids.items.ownPrivate);
    assert.deepEqual(pub.data, []);
    const item = await users.stranger.client.from('items').select('id').eq('id', ids.items.ownPrivate);
    assert.deepEqual(item.data, []);
    const drinks = await anon.from('menu_drinks').select('item_id').eq('menu_id', ids.homeMenu);
    assert.deepEqual(drinks.data ?? [], []);
  });

  test('a drink its bar stops publishing becomes a placeholder', async () => {
    await db.query("UPDATE public.items SET publish_mode = 'private' WHERE id = $1", [ids.items.barDrink]);
    try {
      const menu = await read(anon);
      assert.deepEqual(menu.sections[0].item_ids, [null, null]);
    } finally {
      await db.query('UPDATE public.items SET publish_mode = NULL WHERE id = $1', [ids.items.barDrink]);
    }
  });

  test('blocked either way, the menu is not there', async () => {
    for (const [blocker, blocked] of [['owner', 'stranger'], ['stranger', 'owner']]) {
      assert.ifError((await users[blocker].client.from('user_blocks').insert({ blocked_id: users[blocked].id })).error);
      try {
        assert.equal(await read(users.stranger.client), null, `${blocker} blocked ${blocked}`);
        assert.notEqual(await read(anon), null);
      } finally {
        await db.query('DELETE FROM public.user_blocks WHERE blocker_id = $1', [users[blocker].id]);
      }
    }
  });

  test('a private or moderated owner profile takes the menu down', async () => {
    for (const change of ['is_public = false', 'moderated_at = now()']) {
      await db.query(`UPDATE public.profiles SET ${change} WHERE id = $1`, [ids.ownerProfile]);
      try {
        assert.equal(await read(anon), null, change);
      } finally {
        await db.query('UPDATE public.profiles SET is_public = true, moderated_at = NULL WHERE id = $1', [ids.ownerProfile]);
      }
    }
    assert.notEqual(await read(anon), null);
  });

  test('stopping sharing takes it down', async () => {
    const res = await share(users.owner.client, ids.homeMenu, false);
    assert.ifError(res.error);
    assert.equal(res.data[0].shared_at, null);
    assert.equal(await read(anon), null);
  });
});

// A shared menu's name and section names are public text, so the content
// filter (20260930600000) screens them. The word comes from the filter's own
// list, so this file doesn't spell one out.
describe('screening what a shared menu shows', () => {
  let word;
  const refused = (res, field) => {
    assert.equal(res.error?.code, 'P0001');
    assert.equal(res.error?.message, `That ${field} has a word we don't allow. Please change it.`);
  };
  const newMenu = async (name, sections) => {
    const menu = await users.owner.client.from('menus').insert({ name, bar_id: null }).select('id').single();
    assert.ifError(menu.error);
    const saved = await saveMenu(menu.data.id, name, sections);
    assert.ifError(saved.error);
    return menu.data.id;
  };
  const saveMenu = (menuId, name, sections) =>
    users.owner.client.rpc('save_menu', { p_menu_id: menuId, p_name: name, p_cover_url: null, p_cover_position: 50, p_sections: sections });

  before(async () => {
    word = (await db.query("SELECT word FROM private.screened_words WHERE kind = 'word' ORDER BY word LIMIT 1")).rows[0].word;
  });

  test('a private home menu may say anything; sharing it is refused until it is changed', async () => {
    const menuId = await newMenu(`${word} night ${run}`, [{ name: 'Stirred', item_ids: [] }]);
    refused(await share(users.owner.client, menuId, true), 'menu name');
    const renamed = await saveMenu(menuId, `Quiet night ${run}`, [{ name: `${word} corner`, item_ids: [] }]);
    assert.ifError(renamed.error);
    refused(await share(users.owner.client, menuId, true), 'section name');
    assert.ifError((await saveMenu(menuId, `Quiet night ${run}`, [{ name: 'Nightcaps', item_ids: [] }])).error);
    const ok = await share(users.owner.client, menuId, true);
    assert.ifError(ok.error);
    assert.ok(ok.data[0].shared_at);
  });

  test('once shared, a new name or section with a listed word is refused and nothing changes', async () => {
    const menuId = await newMenu(`Porch party ${run}`, [{ name: 'Sours', item_ids: [] }]);
    assert.ifError((await share(users.owner.client, menuId, true)).error);
    refused(await saveMenu(menuId, `${word} party ${run}`, [{ name: 'Sours', item_ids: [] }]), 'menu name');
    refused(await saveMenu(menuId, `Porch party ${run}`, [{ name: `${word} sours`, item_ids: [] }]), 'section name');
    const menu = await read(anon, menuId);
    assert.equal(menu.name, `Porch party ${run}`);
    assert.deepEqual(menu.sections.map((s) => s.name), ['Sours']);
  });
});
