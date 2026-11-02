// Handover photos (20261206110000_handover_photos.sql): a closer adds a photo
// of what's broken to their own folder at a bar they work at, everyone at the
// bar sees it, nobody else does, and only its owner removes it. Runs through
// the real API against the local stack.
//
//   supabase start && supabase db reset
//   npm run test:security

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';

const status = JSON.parse(execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run handover photo tests against a non-local stack: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const users = {};
const ids = {};
// A 1x1 JPEG is enough: the bucket checks the type, not the picture.
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
const BUCKET = 'handover';

async function makeUser(label) {
  const email = `${label}-${run}@handover-photo-test.local`;
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

const upload = (who, path) => who.client.storage.from(BUCKET).upload(path, JPEG, { contentType: 'image/jpeg' });

before(async () => {
  for (const label of ['ana', 'theo', 'stranger']) users[label] = await makeUser(label);
  ids.bar = (await insert('bars', { name: `Photo bar ${run}` })).id;
  ids.other = (await insert('bars', { name: `Other photo bar ${run}` })).id;
  await insert('user_bars', { user_id: users.ana.id, bar_id: ids.bar, role_level: 30 });
  await insert('user_bars', { user_id: users.theo.id, bar_id: ids.bar, role_level: 10 });
  await insert('user_bars', { user_id: users.stranger.id, bar_id: ids.other, role_level: 40 });
});

after(async () => {
  const { data } = await service.storage.from(BUCKET).list(ids.bar, { limit: 100 });
  for (const folder of data ?? []) {
    const { data: files } = await service.storage.from(BUCKET).list(`${ids.bar}/${folder.name}`);
    await service.storage.from(BUCKET).remove((files ?? []).map((f) => `${ids.bar}/${folder.name}/${f.name}`));
  }
  await service.from('bars').delete().in('id', [ids.bar, ids.other]);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
});

describe('handover photos', () => {
  test('a closer adds a photo to their own folder at their bar', async () => {
    const { error } = await upload(users.ana, `${ids.bar}/${users.ana.id}/ice-well.jpg`);
    assert.equal(error, null);
  });

  test('not into someone else’s folder, nor another bar’s', async () => {
    assert.ok((await upload(users.ana, `${ids.bar}/${users.theo.id}/x.jpg`)).error, 'another person’s folder');
    assert.ok((await upload(users.ana, `${ids.other}/${users.ana.id}/x.jpg`)).error, 'a bar she doesn’t work at');
    assert.ok((await upload(users.stranger, `${ids.bar}/${users.stranger.id}/x.jpg`)).error, 'a stranger at the bar');
  });

  test('everyone at the bar sees it; another bar and signed out do not', async () => {
    const path = `${ids.bar}/${users.ana.id}/ice-well.jpg`;
    const theo = await users.theo.client.storage.from(BUCKET).createSignedUrl(path, 60);
    assert.equal(theo.error, null);
    assert.ok(theo.data?.signedUrl);
    assert.ok((await users.stranger.client.storage.from(BUCKET).createSignedUrl(path, 60)).error);
    assert.ok((await anon.storage.from(BUCKET).createSignedUrl(path, 60)).error);
  });

  test('only its owner removes it', async () => {
    const path = `${ids.bar}/${users.ana.id}/ice-well.jpg`;
    await users.theo.client.storage.from(BUCKET).remove([path]);
    assert.ok((await service.storage.from(BUCKET).list(`${ids.bar}/${users.ana.id}`)).data?.some((f) => f.name === 'ice-well.jpg'), 'still there after Theo tried');
    await users.ana.client.storage.from(BUCKET).remove([path]);
    assert.ok(!(await service.storage.from(BUCKET).list(`${ids.bar}/${users.ana.id}`)).data?.some((f) => f.name === 'ice-well.jpg'), 'gone once Ana removes it');
  });

  test('the note keeps its path', async () => {
    const { error } = await users.ana.client
      .from('handover_notes')
      .upsert({ bar_id: ids.bar, close_date: '2026-10-30', user_id: users.ana.id, broken: 'Ice well', broken_photo: `${ids.bar}/${users.ana.id}/ice-well.jpg`, written_at: new Date().toISOString(), read_at: new Date().toISOString() }, { onConflict: 'bar_id,close_date,user_id' });
    assert.equal(error, null);
  });
});
