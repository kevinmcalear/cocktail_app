// Draw my glass (20261118500000_draw_my_glass.sql): a venue's or a home
// bar's own glass carries its traced outline and the photo it came from,
// private to them; its drinks are drawn in it; it can be shared, and only the
// Cocktail team adds a shared glass to the catalog, credited to the venue.
// Runs against the local stack only: `npm run test:security`.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const status = JSON.parse(execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run draw-my-glass tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });
const users = {};
const ids = {};
const photos = [];
// A tiny JPEG: the bucket takes only JPEGs, and the policies only read the path.
const jpeg = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
  'base64',
);

const OUTLINE = {
  height_mm: 150,
  rim_mm: 90,
  widest_mm: 93,
  stemmed: true,
  outline: [
    [0, 90],
    [10, 93],
    [30, 70],
    [45, 12],
  ],
  bowl_mm: 45,
  stem_to_mm: 140,
  stem_mm: 8,
  foot_mm: 70,
};

async function makeUser(label) {
  const email = `${label}-${run}@draw-my-glass-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

async function insert(table, row) {
  const { data, error } = await service.from(table).insert(row).select().single();
  if (error) throw new Error(`fixture insert into ${table} failed: ${error.message}`);
  return data;
}

const upload = (who, path) => users[who].client.storage.from('glass-photos').upload(path, jpeg, { contentType: 'image/jpeg', upsert: false });

before(async () => {
  await db.connect();
  for (const label of ['admin', 'bartender', 'outsider', 'home', 'team']) users[label] = await makeUser(label);
  await db.query('INSERT INTO private.app_admins (user_id) VALUES ($1)', [users.team.id]);
  ids.bar = (await insert('bars', { name: `Draw bar ${run}` })).id;
  ids.otherBar = (await insert('bars', { name: `Other bar ${run}` })).id;
  ids.page = (await insert('profiles', { kind: 'bar', handle: `drawbar${run}`, display_name: `Draw bar ${run}`, bar_id: ids.bar })).id;
  ids.otherPage = (await insert('profiles', { kind: 'bar', handle: `otherbar${run}`, display_name: `Other bar ${run}`, bar_id: ids.otherBar })).id;
  ids.maker = (await insert('profiles', { kind: 'maker', handle: `hollowfire${run}`, display_name: `Hollow Fire ${run}`, makes: ['glassware'] })).id;
  await insert('user_bars', { user_id: users.admin.id, bar_id: ids.bar, role_level: 40 });
  await insert('user_bars', { user_id: users.bartender.id, bar_id: ids.bar, role_level: 20 });
  ids.drink = (await insert('items', { name: `Rye sour ${run}`, item_type: 'cocktail', bar_id: ids.bar })).id;
});

after(async () => {
  if (photos.length) await service.storage.from('glass-photos').remove(photos);
  if (ids.model) await service.from('glass_models').delete().eq('id', ids.model);
  if (ids.drink) await service.from('items').delete().eq('id', ids.drink);
  for (const id of [ids.page, ids.otherPage, ids.maker]) if (id) await service.from('profiles').delete().eq('id', id);
  for (const id of [ids.bar, ids.otherBar]) if (id) await service.from('bars').delete().eq('id', id);
  await db.query('DELETE FROM private.app_admins WHERE user_id = $1', [users.team.id]);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
  await db.end();
});

describe('a venue’s own glass, traced', () => {
  test('its editors save the outline and the photo; the photo stays under the venue’s page', async () => {
    const path = `bar/${ids.page}/rye-coupe-${run}.jpg`;
    photos.push(path);
    assert.ifError((await upload('admin', path)).error);
    const { data, error } = await users.admin.client
      .from('bar_glassware')
      .insert({ profile_id: ids.page, glass: 'coupe', name: 'Rye coupe', maker: 'Hollow Fire Studio', outline: OUTLINE, photo_path: path, capacity_ml: 205 })
      .select('id, outline, capacity_ml')
      .single();
    assert.ifError(error);
    assert.equal(data.outline.height_mm, 150);
    ids.glass = data.id;
    const elsewhere = await users.admin.client
      .from('bar_glassware')
      .update({ photo_path: `bar/${ids.otherPage}/x.jpg` })
      .eq('id', ids.glass);
    assert.ok(elsewhere.error, 'a photo path under another venue is refused');
    const sneaky = await users.admin.client
      .from('bar_glassware')
      .update({ photo_path: `bar/${ids.page}/../x.jpg` })
      .eq('id', ids.glass);
    assert.ok(sneaky.error, 'one spelling only');
  });

  test('an outline the painter can’t draw is refused, and capacity needs an outline', async () => {
    const bad = await service.from('bar_glassware').insert({ profile_id: ids.page, glass: 'rocks', is_default: false, outline: { height_mm: 90 } });
    assert.ok(bad.error);
    const noOutline = await service.from('bar_glassware').insert({ profile_id: ids.page, glass: 'rocks', is_default: false, capacity_ml: 300 });
    assert.ok(noOutline.error);
  });

  test('its drinks are drawn in it', async () => {
    const inputs = {
      v: 2,
      glass: 'coupe',
      ice: 'none',
      method: 'shake',
      liquid: { hex: '#c8a040', alpha: 0.8 },
      foam: null,
      float: null,
      bleed: null,
      fizz: false,
      garnish: null,
      from: { glass: 'data', ice: 'rules', method: 'rules', liquid: 'rules', garnish: 'rules' },
      coverage: 1,
    };
    const { data, error } = await service
      .from('item_sketches')
      .upsert({ item_id: ids.drink, inputs, source: 'rules', spec_fingerprint: run, rules_version: 1 }, { onConflict: 'item_id' })
      .select('inputs')
      .single();
    assert.ifError(error);
    assert.deepEqual(data.inputs.outline, OUTLINE);
  });

  test('its staff see the photo; only its editors add or remove one; others and anon see nothing', async () => {
    const path = `bar/${ids.page}/rye-coupe-${run}.jpg`;
    assert.ifError((await users.bartender.client.storage.from('glass-photos').download(path)).error);
    assert.ifError((await users.team.client.storage.from('glass-photos').download(path)).error);
    assert.ok((await users.outsider.client.storage.from('glass-photos').download(path)).error);
    assert.ok((await anon.storage.from('glass-photos').download(path)).error);
    assert.ok((await upload('bartender', `bar/${ids.page}/b-${run}.jpg`)).error, 'staff without the kit can’t add one');
    assert.ok((await upload('admin', `bar/${ids.otherPage}/a-${run}.jpg`)).error, 'not into another venue');
    assert.ok((await upload('admin', `${ids.page}/a-${run}.jpg`)).error, 'not outside bar/ and home/');
    await users.outsider.client.storage.from('glass-photos').remove([path]);
    assert.ok(
      (await service.storage.from('glass-photos').list(`bar/${ids.page}`)).data.some((f) => path.endsWith(f.name)),
      'an outsider removes nothing',
    );
  });

  test('JPEGs only', async () => {
    const path = `bar/${ids.page}/x-${run}.png`;
    const { error } = await users.admin.client.storage.from('glass-photos').upload(path, jpeg, { contentType: 'image/png' });
    assert.ok(error);
  });
});

describe('a home glass, traced', () => {
  test('the owner keeps the photo under their own folder; nobody else sees it', async () => {
    const path = `home/${users.home.id}/grandmas-${run}.jpg`;
    photos.push(path);
    assert.ifError((await upload('home', path)).error);
    assert.ok((await upload('outsider', `home/${users.home.id}/x-${run}.jpg`)).error);
    const { data, error } = await users.home.client
      .from('home_glassware')
      .insert({ glass: 'coupe', name: 'Grandma’s coupe', outline: OUTLINE, photo_path: path, is_default: true })
      .select('id')
      .single();
    assert.ifError(error);
    ids.homeGlass = data.id;
    assert.ok((await users.outsider.client.storage.from('glass-photos').download(path)).error);
    const wrong = await users.home.client
      .from('home_glassware')
      .update({ photo_path: `home/${users.outsider.id}/x.jpg` })
      .eq('id', ids.homeGlass);
    assert.ok(wrong.error);
  });
});

describe('sharing a traced glass', () => {
  test('its editors share it in review; staff without the kit and outsiders can’t', async () => {
    assert.ok((await users.bartender.client.from('glass_shares').insert({ bar_glass_id: ids.glass })).error);
    assert.ok((await users.outsider.client.from('glass_shares').insert({ bar_glass_id: ids.glass })).error);
    assert.ok((await users.admin.client.from('glass_shares').insert({ bar_glass_id: ids.glass, status: 'added' })).error, 'only in review');
    const { data, error } = await users.admin.client.from('glass_shares').insert({ bar_glass_id: ids.glass }).select('id, status, sent_by').single();
    assert.ifError(error);
    assert.deepEqual([data.status, data.sent_by], ['in_review', users.admin.id]);
    ids.share = data.id;
    assert.equal((await users.bartender.client.from('glass_shares').select('id').eq('id', ids.share)).data.length, 1, 'its staff see it');
    assert.deepEqual((await users.outsider.client.from('glass_shares').select('id')).data, []);
  });

  test('a glass with no outline can’t be shared', async () => {
    const plain = await insert('bar_glassware', { profile_id: ids.page, glass: 'highball', name: 'Plain' });
    assert.ok((await users.admin.client.from('glass_shares').insert({ bar_glass_id: plain.id })).error);
  });

  test('they can’t mark it added themselves; Stop sharing takes it back', async () => {
    const { data } = await users.admin.client.from('glass_shares').update({ status: 'added' }).eq('id', ids.share).select('id');
    assert.ok(!data?.length);
    assert.ifError((await users.admin.client.from('glass_shares').delete().eq('id', ids.share)).error);
    ids.share = (await users.admin.client.from('glass_shares').insert({ bar_glass_id: ids.glass }).select('id').single()).data.id;
  });

  test('a home bar shares its glass; the Cocktail team reads it to check it', async () => {
    const { data, error } = await users.home.client.from('glass_shares').insert({ home_glass_id: ids.homeGlass }).select('id').single();
    assert.ifError(error);
    ids.homeShare = data.id;
    const seen = await users.team.client.from('home_glassware').select('name, outline').eq('id', ids.homeGlass).single();
    assert.ifError(seen.error);
    assert.equal(seen.data.name, 'Grandma’s coupe');
    assert.ok((await users.team.client.storage.from('glass-photos').download(`home/${users.home.id}/grandmas-${run}.jpg`)).data);
  });

  test('only the Cocktail team adds it to the catalog, credited to the venue and citing no page', async () => {
    const refused = await users.admin.client.rpc('add_shared_glass', { p_share_id: ids.share, p_maker_profile_id: ids.maker });
    assert.ok(refused.error);
    const { data: model, error } = await users.team.client.rpc('add_shared_glass', { p_share_id: ids.share, p_maker_profile_id: ids.maker });
    assert.ifError(error);
    ids.model = model;
    const { data: row } = await service.from('glass_models').select('name, glass, capacity_ml, height_mm, outline, source_urls, from_photo, traced_by_profile_id').eq('id', model).single();
    assert.equal(row.name, 'Rye coupe');
    assert.equal(Number(row.capacity_ml), 205);
    assert.equal(Number(row.height_mm), 150);
    assert.deepEqual(row.outline, OUTLINE);
    assert.deepEqual([row.source_urls, row.from_photo, row.traced_by_profile_id], [[], true, ids.page]);
    const share = (await users.admin.client.from('glass_shares').select('status, model_id').eq('id', ids.share).single()).data;
    assert.deepEqual(share, { status: 'added', model_id: model });
    assert.ok((await users.admin.client.from('glass_shares').delete().eq('id', ids.share).select('id')).data?.length === 0, 'an added glass stays');
    const twice = await users.team.client.rpc('add_shared_glass', { p_share_id: ids.share, p_maker_profile_id: ids.maker });
    assert.ok(twice.error);
  });

  test('every other catalog glass still cites a page', async () => {
    const { error } = await service.from('glass_models').insert({ maker_profile_id: ids.maker, glass: 'rocks', name: `No source ${run}`, source_urls: [] });
    assert.ok(error);
  });

  test('the team declines one with a note; nobody else can', async () => {
    assert.ok((await users.home.client.rpc('decline_shared_glass', { p_share_id: ids.homeShare, p_note: 'no' })).error);
    assert.ifError((await users.team.client.rpc('decline_shared_glass', { p_share_id: ids.homeShare, p_note: 'Already in the catalog' })).error);
    const share = (await users.home.client.from('glass_shares').select('status, note').eq('id', ids.homeShare).single()).data;
    assert.deepEqual(share, { status: 'declined', note: 'Already in the catalog' });
  });

  test('a declined glass can be sent again: the old share goes, a new one is in review', async () => {
    assert.ifError((await users.home.client.from('glass_shares').delete().eq('id', ids.homeShare)).error);
    const { data, error } = await users.home.client.from('glass_shares').insert({ home_glass_id: ids.homeGlass }).select('status').single();
    assert.ifError(error);
    assert.equal(data.status, 'in_review');
  });

  test('anon sees no shares', async () => {
    const { data } = await anon.from('glass_shares').select('id');
    assert.deepEqual(data ?? [], []);
  });
});
