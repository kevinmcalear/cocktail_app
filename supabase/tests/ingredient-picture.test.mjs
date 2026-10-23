// An ingredient's picture (20261103520000_ingredient_picture.sql): its
// drawing, its own photo, or none. Only someone who can edit the ingredient
// sets it; shared catalogue items stay drawn; old catalogue photos in
// item_images never show; the photo is seen by whoever sees the ingredient.
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
  throw new Error(`Refusing to run ingredient picture tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });
const PHOTO_ROOT = `${status.API_URL}/storage/v1/object/public/drinks/ingredients/picture-test-${run}`;

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

async function item(row) {
  const cols = Object.keys(row);
  const { rows } = await db.query(
    `INSERT INTO public.items (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
    Object.values(row)
  );
  return rows[0].id;
}

const image = async (name) => (await db.query('INSERT INTO public.images (url) VALUES ($1) RETURNING id', [`${PHOTO_ROOT}/${name}.jpg`])).rows[0].id;

/** What `who` reads of an item's picture through the presentation view (null: the row is hidden). */
async function shown(who, id) {
  const { data, error } = await users[who].client.from('app_item_presentation').select('picture, picture_url').eq('id', id);
  assert.ifError(error);
  return data[0] ?? null;
}

const setPicture = (who, id, picture, imageId) =>
  users[who].client.rpc('set_item_picture', { p_item_id: id, p_picture: picture, ...(imageId ? { p_image_id: imageId } : {}) });

const stored = async (id) => (await db.query('SELECT picture FROM public.items WHERE id = $1', [id])).rows[0].picture;

before(async () => {
  await db.connect();
  for (const label of ['editor', 'member', 'stranger', 'homeCook', 'admin']) users[label] = await makeUser(label);
  await db.query('INSERT INTO private.app_admins (user_id) VALUES ($1)', [users.admin.id]);
  ids.venue = (await db.query('INSERT INTO public.bars (name) VALUES ($1) RETURNING id', [`Picture Bar ${run}`])).rows[0].id;
  // 40 edits drinks; 30 sees the menu and specs but can't edit.
  await db.query('INSERT INTO public.user_bars (bar_id, user_id, role_level) VALUES ($1, $2, 40), ($1, $3, 30)', [ids.venue, users.editor.id, users.member.id]);

  ids.shrub = await item({ name: `Smoked Pear Shrub ${run}`, item_type: 'ingredient', bar_id: ids.venue, ingredient_role: 'prep' });
  ids.catalogue = await item({ name: `Campari ${run}`, item_type: 'ingredient', is_catalog: true });
  ids.shared = await item({ name: `Orgeat ${run}`, item_type: 'ingredient' });
  ids.homeSyrup = await item({ name: `Fig syrup ${run}`, item_type: 'ingredient', created_by: users.homeCook.id });
  ids.drink = await item({ name: `Smoked Pear Sour ${run}`, item_type: 'cocktail', bar_id: ids.venue });

  // Old catalogue photos, linked the way they were before drawings: never shown.
  ids.legacy = await image('legacy');
  await db.query('INSERT INTO public.item_images (item_id, image_id) VALUES ($1, $3), ($2, $3)', [ids.catalogue, ids.shrub, ids.legacy]);
  ids.photo = await image('shrub');
  ids.photo2 = await image('shrub-2');
  ids.homePhoto = await image('fig');
});

after(async () => {
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [`%${run}`]);
  await db.query('DELETE FROM public.images WHERE url LIKE $1', [`${PHOTO_ROOT}/%`]);
  await db.query('DELETE FROM public.bars WHERE id = $1', [ids.venue]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('before anyone chooses', () => {
  test('every ingredient is drawn, and old item_images photos stay hidden', async () => {
    assert.deepEqual(await shown('editor', ids.shrub), { picture: 'drawing', picture_url: null });
    assert.deepEqual(await shown('editor', ids.catalogue), { picture: 'drawing', picture_url: null });
  });

  test('picking Your photo with no photo is refused', async () => {
    const { error } = await setPicture('editor', ids.shrub, 'photo');
    assert.equal(error?.code, '22023');
    assert.equal(await stored(ids.shrub), 'drawing');
  });
});

describe("a bar's house prep", () => {
  test('its editor sets a photo, and the old link still never shows', async () => {
    const { error } = await setPicture('editor', ids.shrub, 'photo', ids.photo);
    assert.ifError(error);
    assert.deepEqual(await shown('editor', ids.shrub), { picture: 'photo', picture_url: `${PHOTO_ROOT}/shrub.jpg` });
    const { rows } = await db.query('SELECT count(*)::int AS n FROM public.item_images WHERE item_id = $1 AND is_picture', [ids.shrub]);
    assert.equal(rows[0].n, 1);
  });

  test('a new photo replaces the last one', async () => {
    assert.ifError((await setPicture('editor', ids.shrub, 'photo', ids.photo2)).error);
    assert.equal((await shown('editor', ids.shrub)).picture_url, `${PHOTO_ROOT}/shrub-2.jpg`);
    const { rows } = await db.query('SELECT image_id FROM public.item_images WHERE item_id = $1 AND is_picture', [ids.shrub]);
    assert.deepEqual(rows.map((r) => r.image_id), [ids.photo2]);
  });

  test('whoever sees the ingredient sees its photo; someone outside the bar sees neither', async () => {
    assert.deepEqual(await shown('member', ids.shrub), { picture: 'photo', picture_url: `${PHOTO_ROOT}/shrub-2.jpg` });
    assert.equal(await shown('stranger', ids.shrub), null);
  });

  test('None hides the photo but keeps it for its editor, and Your photo brings it back', async () => {
    assert.ifError((await setPicture('editor', ids.shrub, 'none')).error);
    assert.deepEqual(await shown('member', ids.shrub), { picture: 'none', picture_url: null });
    assert.deepEqual(await shown('editor', ids.shrub), { picture: 'none', picture_url: `${PHOTO_ROOT}/shrub-2.jpg` });
    assert.ifError((await setPicture('editor', ids.shrub, 'photo')).error);
    assert.equal((await shown('member', ids.shrub)).picture_url, `${PHOTO_ROOT}/shrub-2.jpg`);
  });

  test("staff who can't edit it change nothing, through the function or the tables", async () => {
    const before = await stored(ids.shrub);
    const { error } = await setPicture('member', ids.shrub, 'none');
    assert.equal(error?.code, '42501');
    const { data } = await users.member.client.from('items').update({ picture: 'none' }).eq('id', ids.shrub).select('id');
    assert.deepEqual(data ?? [], []);
    const link = await users.member.client.from('item_images').insert({ item_id: ids.shrub, image_id: ids.photo, is_picture: false });
    assert.ok(link.error, 'a member may not link a photo');
    const unmark = await users.member.client.from('item_images').update({ is_picture: false }).eq('item_id', ids.shrub).select('id');
    assert.deepEqual(unmark.data ?? [], []);
    assert.equal(await stored(ids.shrub), before);
  });

  test("a stranger can't set it either", async () => {
    const { error } = await setPicture('stranger', ids.shrub, 'drawing');
    assert.equal(error?.code, '42501');
  });
});

describe('catalogue and shared items stay drawn', () => {
  test("a venue editor can't change a catalogue bottle", async () => {
    assert.equal((await setPicture('editor', ids.catalogue, 'photo', ids.photo)).error?.code, '42501');
    assert.equal((await setPicture('editor', ids.catalogue, 'none')).error?.code, '42501');
    const { data } = await users.editor.client.from('items').update({ picture: 'none' }).eq('id', ids.catalogue).select('id');
    assert.deepEqual(data ?? [], []);
    const link = await users.editor.client.from('item_images').insert({ item_id: ids.catalogue, image_id: ids.photo, is_picture: true });
    assert.ok(link.error, 'a venue editor may not mark a photo on a catalogue item');
    assert.equal(await stored(ids.catalogue), 'drawing');
  });

  test('not even an app admin gives a shared item a photo or None', async () => {
    assert.equal((await setPicture('admin', ids.catalogue, 'none')).error?.code, '42501');
    assert.equal((await setPicture('admin', ids.shared, 'photo', ids.photo)).error?.code, '42501');
    const marked = await users.admin.client.from('item_images').insert({ item_id: ids.shared, image_id: ids.photo, is_picture: true });
    assert.equal(marked.error?.code, '42501');
    assert.deepEqual(await shown('admin', ids.shared), { picture: 'drawing', picture_url: null });
  });

  test('the view reads a shared item as drawn, whatever it holds', async () => {
    await db.query('BEGIN');
    try {
      // Past the guard, as data from before it would be (no table lock on the shared stack).
      await db.query("SET LOCAL session_replication_role = replica");
      await db.query("UPDATE public.items SET picture = 'none' WHERE id = $1", [ids.shared]);
      const { rows } = await db.query(
        "SELECT set_config('request.jwt.claims', $1, true), set_config('role', 'authenticated', true)",
        [JSON.stringify({ sub: users.editor.id, role: 'authenticated' })]
      );
      assert.ok(rows.length);
      const view = await db.query('SELECT picture, picture_url FROM public.app_item_presentation WHERE id = $1', [ids.shared]);
      assert.deepEqual(view.rows[0], { picture: 'drawing', picture_url: null });
    } finally {
      await db.query('ROLLBACK');
    }
  });

  test('merging an ingredient with its own photo into a catalogue one still works', async () => {
    await db.query('BEGIN');
    try {
      // What private.merge_ingredient does to the links of the one merged away.
      await db.query('UPDATE public.item_images SET item_id = $1 WHERE item_id = $2', [ids.catalogue, ids.shrub]);
      const { rows } = await db.query('SELECT count(*)::int AS n FROM public.item_images WHERE item_id = $1 AND is_picture', [ids.catalogue]);
      assert.equal(rows[0].n, 1);
    } finally {
      await db.query('ROLLBACK');
    }
  });

  test('a drink has no ingredient picture to choose', async () => {
    assert.equal((await setPicture('editor', ids.drink, 'none')).error?.code, '42501');
  });
});

describe('signed out', () => {
  // items_select is for signed-in readers only, so a visitor reads no ingredient
  // rows, and so no photo. What matters here: the read works (every function
  // the view calls is granted to anon) instead of failing the whole query.
  test('a visitor reads picture and picture_url without an error, and sees no photo', async () => {
    const visitor = createClient(status.API_URL, status.ANON_KEY, clientOptions);
    for (const id of [ids.shrub, ids.homeSyrup, ids.catalogue]) {
      const { data, error } = await visitor.from('app_item_presentation').select('picture, picture_url').eq('id', id);
      assert.ifError(error);
      assert.deepEqual(data, []);
    }
    const all = await visitor.from('app_item_presentation').select('id, picture, picture_url').limit(5);
    assert.ifError(all.error);
  });

  test('the anon role plans the view with no missing EXECUTE grant', async () => {
    await db.query('BEGIN');
    try {
      await db.query('SET LOCAL ROLE anon');
      await db.query('SELECT count(picture), count(picture_url) FROM public.app_item_presentation');
    } finally {
      await db.query('ROLLBACK');
    }
  });
});

describe("a home cook's own ingredient", () => {
  test('its maker sets a photo; nobody else can', async () => {
    assert.ifError((await setPicture('homeCook', ids.homeSyrup, 'photo', ids.homePhoto)).error);
    assert.deepEqual(await shown('homeCook', ids.homeSyrup), { picture: 'photo', picture_url: `${PHOTO_ROOT}/fig.jpg` });
    assert.equal((await setPicture('stranger', ids.homeSyrup, 'none')).error?.code, '42501');
    assert.equal(await stored(ids.homeSyrup), 'photo');
  });
});
