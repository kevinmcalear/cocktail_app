// A brand's own photos on its catalogue bottles
// (20261108100000_maker_bottle_photos.sql): only the claimed maker's team sets
// them, never None; a team's first photo waits for a moderator, later ones
// show at once; waiting photos never reach the presentation view; venue
// editors and app admins still can't picture a shared bottle themselves.
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
  throw new Error(`Refusing to run maker bottle photo tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });
const BUCKET = `${status.API_URL}/storage/v1/object/public/drinks`;

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

const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const bottle = async (name, makerId) =>
  (await one("INSERT INTO public.items (name, item_type, ingredient_role, maker_profile_id) VALUES ($1, 'ingredient', 'product', $2) RETURNING id", [`${name} ${run}`, makerId])).id;
const image = async (path) => (await one('INSERT INTO public.images (url) VALUES ($1) RETURNING id', [`${BUCKET}/${path}`])).id;
const forBottle = (itemId, name) => image(`ingredients/${itemId}/${name}-${run}.png`);

const setPicture = (who, itemId, picture, imageId) =>
  users[who].client.rpc('set_maker_bottle_picture', { p_item_id: itemId, p_picture: picture, ...(imageId ? { p_image_id: imageId } : {}) });

/** What `who` reads of an item's picture through the presentation view. */
async function shown(who, itemId) {
  const { data, error } = await users[who].client.from('app_item_presentation').select('picture, picture_url').eq('id', itemId);
  assert.ifError(error);
  return data[0] ?? null;
}

const urlOf = async (imageId) => (await one('SELECT url FROM public.images WHERE id = $1', [imageId])).url;

before(async () => {
  await db.connect();
  for (const label of ['brand', 'brandViewer', 'venueEditor', 'stranger', 'moderator']) users[label] = await makeUser(label);
  await db.query('INSERT INTO private.app_admins (user_id) VALUES ($1)', [users.moderator.id]);

  // A claimed maker page runs from the venue its claim made (Drink Creator and up may picture its bottles).
  ids.brandVenue = (await one('INSERT INTO public.bars (name) VALUES ($1) RETURNING id', [`Harbour Lane ${run}`])).id;
  ids.otherVenue = (await one('INSERT INTO public.bars (name) VALUES ($1) RETURNING id', [`Little Rye ${run}`])).id;
  await db.query('INSERT INTO public.user_bars (bar_id, user_id, role_level) VALUES ($1, $2, 40), ($1, $3, 30), ($4, $5, 40)', [
    ids.brandVenue, users.brand.id, users.brandViewer.id, ids.otherVenue, users.venueEditor.id,
  ]);
  ids.maker = (await one("INSERT INTO public.profiles (kind, handle, display_name, bar_id, is_public) VALUES ('maker', $1, $2, $3, true) RETURNING id", [`harbourlane${run}`, `Harbour Lane ${run}`, ids.brandVenue])).id;
  ids.otherMaker = (await one("INSERT INTO public.profiles (kind, handle, display_name, is_public) VALUES ('maker', $1, $2, true) RETURNING id", [`campari${run}`, `Campari Group ${run}`])).id;

  ids.gin = await bottle('Harbour Lane Dry Gin', ids.maker);
  ids.rosso = await bottle('Wharf Rosso', ids.maker);
  ids.campari = await bottle('Campari', ids.otherMaker);
  ids.ownCopy = (await one("INSERT INTO public.items (name, item_type, bar_id, maker_profile_id) VALUES ($1, 'ingredient', $2, $3) RETURNING id", [`Bar gin ${run}`, ids.otherVenue, ids.maker])).id;

  ids.ginPhoto = await forBottle(ids.gin, 'gin');
  ids.ginPhoto2 = await forBottle(ids.gin, 'gin-2');
  ids.rossoPhoto = await forBottle(ids.rosso, 'rosso');
  ids.campariPhoto = await forBottle(ids.campari, 'campari');
  ids.elsewhere = await image(`drinks-of-the-week/gin-${run}.png`);
});

after(async () => {
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [`%${run}`]);
  await db.query('DELETE FROM public.images WHERE url LIKE $1', [`%-${run}.png`]);
  await db.query('DELETE FROM public.profiles WHERE id = ANY($1)', [[ids.maker, ids.otherMaker]]);
  await db.query('DELETE FROM public.bars WHERE id = ANY($1)', [[ids.brandVenue, ids.otherVenue]]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe("who can picture a maker's bottle", () => {
  test('nobody else: a viewer on the team, a venue editor, a stranger or a moderator', async () => {
    for (const who of ['brandViewer', 'venueEditor', 'stranger', 'moderator']) {
      const { error } = await setPicture(who, ids.gin, 'photo', ids.ginPhoto);
      assert.equal(error?.code, '42501', who);
    }
    assert.deepEqual(await shown('stranger', ids.gin), { picture: 'drawing', picture_url: null });
  });

  test("the team can't picture another maker's bottle, or a bar's own copy", async () => {
    assert.equal((await setPicture('brand', ids.campari, 'photo', ids.campariPhoto)).error?.code, '42501');
    assert.equal((await setPicture('brand', ids.ownCopy, 'drawing')).error?.code, '42501');
  });

  test('the old path stays shut: set_item_picture and the tables refuse a shared bottle', async () => {
    const viaOld = await users.brand.client.rpc('set_item_picture', { p_item_id: ids.gin, p_picture: 'photo', p_image_id: ids.ginPhoto });
    assert.equal(viaOld.error?.code, '42501');
    const { data } = await users.brand.client.from('items').update({ picture: 'photo' }).eq('id', ids.gin).select('id');
    assert.deepEqual(data ?? [], []);
    const link = await users.brand.client.from('item_images').insert({ item_id: ids.gin, image_id: ids.ginPhoto, is_picture: true });
    assert.ok(link.error, 'the team may not link a photo by hand');
  });

  test('None is refused, and so is a photo uploaded for something else', async () => {
    assert.equal((await setPicture('brand', ids.gin, 'none')).error?.code, '22023');
    assert.equal((await setPicture('brand', ids.gin, 'photo', ids.elsewhere)).error?.code, '22023');
    assert.equal((await setPicture('brand', ids.gin, 'photo', ids.rossoPhoto)).error?.code, '22023');
    assert.equal((await setPicture('brand', ids.gin, 'photo')).error?.code, '22023', 'Photo with no photo yet');
    assert.equal((await setPicture('brand', ids.gin, 'drawing', ids.ginPhoto)).error?.code, '22023', 'a new photo with Drawing');
  });
});

describe("a team's first photo waits for a check", () => {
  test('it saves, but only the team (and moderators) see it, as waiting', async () => {
    assert.ifError((await setPicture('brand', ids.gin, 'photo', ids.ginPhoto)).error);
    for (const who of ['brand', 'venueEditor', 'stranger']) {
      assert.deepEqual(await shown(who, ids.gin), { picture: 'drawing', picture_url: null }, who);
    }
    const team = await users.brand.client.rpc('maker_bottle_photos', { p_profile_id: ids.maker });
    assert.ifError(team.error);
    assert.deepEqual(team.data, [{ item_id: ids.gin, url: await urlOf(ids.ginPhoto), checked: false }]);
    const outsider = await users.venueEditor.client.rpc('maker_bottle_photos', { p_profile_id: ids.maker });
    assert.ifError(outsider.error);
    assert.deepEqual(outsider.data, []);
  });

  test("the moderators' queue lists it; nobody else's does", async () => {
    const mine = await users.moderator.client.rpc('maker_photos_waiting');
    assert.ifError(mine.error);
    assert.ok(mine.data.some((r) => r.item_id === ids.gin && r.maker_id === ids.maker));
    const theirs = await users.brand.client.rpc('maker_photos_waiting');
    assert.ifError(theirs.error);
    assert.deepEqual(theirs.data, []);
    assert.equal((await users.brand.client.rpc('check_maker_photo', { p_item_id: ids.gin, p_keep: true })).error?.code, '42501');
  });

  test('a moderator keeps it, and everyone sees it', async () => {
    assert.ifError((await users.moderator.client.rpc('check_maker_photo', { p_item_id: ids.gin, p_keep: true })).error);
    const url = await urlOf(ids.ginPhoto);
    for (const who of ['brand', 'venueEditor', 'stranger']) {
      assert.deepEqual(await shown(who, ids.gin), { picture: 'photo', picture_url: url }, who);
    }
  });
});

describe('once one photo is checked', () => {
  test("the maker's next photos show at once, a new one replacing the last", async () => {
    assert.ifError((await setPicture('brand', ids.rosso, 'photo', ids.rossoPhoto)).error);
    assert.equal((await shown('stranger', ids.rosso)).picture_url, await urlOf(ids.rossoPhoto));
    assert.ifError((await setPicture('brand', ids.gin, 'photo', ids.ginPhoto2)).error);
    assert.equal((await shown('stranger', ids.gin)).picture_url, await urlOf(ids.ginPhoto2));
    const { rows } = await db.query('SELECT image_id FROM public.item_images WHERE item_id = $1 AND is_picture', [ids.gin]);
    assert.deepEqual(rows.map((r) => r.image_id), [ids.ginPhoto2]);
  });

  test("Drawing hides the photo but keeps it, and Photo brings it back", async () => {
    assert.ifError((await setPicture('brand', ids.gin, 'drawing')).error);
    assert.deepEqual(await shown('stranger', ids.gin), { picture: 'drawing', picture_url: null });
    assert.ifError((await setPicture('brand', ids.gin, 'photo')).error);
    assert.equal((await shown('stranger', ids.gin)).picture, 'photo');
  });

  test('a moderator can take a photo off: the bottle goes back to its drawing', async () => {
    assert.ifError((await users.moderator.client.rpc('check_maker_photo', { p_item_id: ids.rosso, p_keep: false })).error);
    assert.deepEqual(await shown('stranger', ids.rosso), { picture: 'drawing', picture_url: null });
    const { rows } = await db.query('SELECT count(*)::int AS n FROM public.item_images WHERE item_id = $1 AND is_picture', [ids.rosso]);
    assert.equal(rows[0].n, 0);
  });

  test("another maker's first photo still waits", async () => {
    // Campari's own team (a fresh claim) gets the same first-photo check.
    await db.query('UPDATE public.profiles SET bar_id = $1 WHERE id = $2', [ids.otherVenue, ids.otherMaker]);
    try {
      assert.ifError((await setPicture('venueEditor', ids.campari, 'photo', ids.campariPhoto)).error);
      assert.deepEqual(await shown('stranger', ids.campari), { picture: 'drawing', picture_url: null });
    } finally {
      await db.query('UPDATE public.profiles SET bar_id = NULL WHERE id = $1', [ids.otherMaker]);
    }
  });
});

describe('signed out', () => {
  test('the anon role reads the view with every function it calls granted', async () => {
    await db.query('BEGIN');
    try {
      await db.query('SET LOCAL ROLE anon');
      await db.query('SELECT count(picture), count(picture_url) FROM public.app_item_presentation');
    } finally {
      await db.query('ROLLBACK');
    }
  });

  test("a visitor can't call the team's or the moderators' functions", async () => {
    const visitor = createClient(status.API_URL, status.ANON_KEY, clientOptions);
    for (const [fn, args] of [
      ['set_maker_bottle_picture', { p_item_id: ids.gin, p_picture: 'drawing' }],
      ['maker_bottle_photos', { p_profile_id: ids.maker }],
      ['maker_photos_waiting', {}],
      ['check_maker_photo', { p_item_id: ids.gin, p_keep: false }],
    ]) {
      const { error } = await visitor.rpc(fn, args);
      assert.ok(error, `${fn} should refuse a visitor`);
    }
  });
});
