// Tell us notes and Report a problem: who can send and who can read
// (supabase/migrations/20261101300000_tell_us_notes.sql).
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
  throw new Error(`Refusing to run tell us tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

const users = {};
const ids = {};
const photos = [];

async function makeUser(label) {
  const email = `${label}-${run}@security-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

const note = (extra = {}) => ({ screen: 'Adding a drink › Ice', drink_name: 'Ash Garden', kind: 'tell_us', body: `Stacked ice ${run}`, app_version: '1.5.0', device: 'ios 26', ...extra });
const send = (who, extra) => users[who].client.from('feedback_notes').insert(note(extra)).select().single();

before(async () => {
  await db.connect();
  for (const label of ['sender', 'other', 'team', 'busy', 'burst', 'racer']) users[label] = await makeUser(label);
  await db.query('INSERT INTO private.app_admins (user_id) VALUES ($1)', [users.team.id]);
  ids.bar = (await service.from('bars').insert({ name: `Tell us bar ${run}` }).select('id').single()).data.id;
  ids.otherBar = (await service.from('bars').insert({ name: `Not theirs ${run}` }).select('id').single()).data.id;
  await service.from('user_bars').insert({ user_id: users.sender.id, bar_id: ids.bar, role_level: 20 });
});

after(async () => {
  const userIds = Object.values(users).map((u) => u.id);
  if (photos.length) await service.storage.from('feedback').remove(photos);
  await db.query('DELETE FROM public.feedback_notes WHERE user_id = ANY($1)', [userIds]);
  await db.query('DELETE FROM private.app_admins WHERE user_id = ANY($1)', [userIds]);
  for (const id of [ids.bar, ids.otherBar]) if (id) await service.from('bars').delete().eq('id', id);
  for (const id of userIds) await service.auth.admin.deleteUser(id);
  await db.end();
});

describe('feedback notes', () => {
  test('a signed-in person sends a note as themselves, from their own bar', async () => {
    const { data, error } = await send('sender', { bar_id: ids.bar });
    assert.ifError(error);
    assert.equal(data.user_id, users.sender.id);
    assert.equal(data.bar_id, ids.bar);
    ids.note = data.id;
  });

  test('a report needs no words; a Tell us note does', async () => {
    const report = await send('sender', { kind: 'slow', body: '', screen: 'Settings › Report a problem', drink_name: null });
    assert.ifError(report.error);
    const empty = await send('sender', { body: '   ' });
    assert.ok(empty.error, 'a Tell us note with no words is refused');
  });

  test('nobody sends a note as someone else', async () => {
    const body = `Posing ${run}`;
    const { error } = await users.other.client.from('feedback_notes').insert(note({ user_id: users.sender.id, body }));
    assert.ok(error, 'insert as another user is refused');
    const { count } = await service.from('feedback_notes').select('id', { count: 'exact', head: true }).eq('body', body);
    assert.equal(count, 0);
  });

  test('nobody tags a bar they do not belong to', async () => {
    const { error } = await send('sender', { bar_id: ids.otherBar });
    assert.ok(error, 'a bar the sender is not at is refused');
  });

  test('signed out, nothing goes in and nothing comes out', async () => {
    const { error } = await anon.from('feedback_notes').insert(note());
    assert.ok(error);
    const { data } = await anon.from('feedback_notes').select('id');
    assert.deepEqual(data ?? [], []);
  });

  test('the id and the date are not the sender\'s to set', async () => {
    const { error } = await send('sender', { created_at: '2020-01-01T00:00:00Z' });
    assert.ok(error, 'setting created_at is refused');
  });

  test('a photo path has to be in the sender\'s own folder', async () => {
    const theirs = await send('sender', { photo_path: `${users.other.id}/x.jpg` });
    assert.ok(theirs.error, 'a path in someone else\'s folder is refused');
    const sneaky = await send('sender', { photo_path: `${users.sender.id}/../${users.other.id}/x.jpg` });
    assert.ok(sneaky.error, 'a path that climbs out is refused');
    // One spelling only, so "a photo with a note stays" can't be dodged with another.
    for (const odd of [`${users.sender.id}/./x.png`, `${users.sender.id}//x.png`, `${users.sender.id}/x.exe`]) {
      const { error } = await send('sender', { photo_path: odd });
      assert.ok(error, `${odd.slice(37)} is refused`);
    }
  });

  test('the database caps the length of the words', async () => {
    const { error } = await send('sender', { body: 'x'.repeat(2001) });
    assert.ok(error);
  });

  test('the sender reads their own notes; others read none of them', async () => {
    const mine = await users.sender.client.from('feedback_notes').select('id').eq('id', ids.note);
    assert.equal(mine.data.length, 1);
    const theirs = await users.other.client.from('feedback_notes').select('id').eq('user_id', users.sender.id);
    assert.ifError(theirs.error);
    assert.equal(theirs.data.length, 0);
  });

  test('the Cocktail team reads every note', async () => {
    const { data, error } = await users.team.client.from('feedback_notes').select('id, user_id').eq('id', ids.note);
    assert.ifError(error);
    assert.equal(data.length, 1);
  });

  test('senders can\'t change or delete a note once sent', async () => {
    await users.sender.client.from('feedback_notes').update({ body: 'changed' }).eq('id', ids.note);
    await users.sender.client.from('feedback_notes').delete().eq('id', ids.note);
    const { data } = await service.from('feedback_notes').select('body').eq('id', ids.note).single();
    assert.equal(data.body, note().body);
  });

  test('at most 20 notes a day', async () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ ...note({ body: `n${i}` }), user_id: users.busy.id }));
    const filled = await service.from('feedback_notes').insert(rows);
    assert.ifError(filled.error);
    const { error } = await send('busy');
    assert.ok(error, 'the 21st note today is refused');
    // Its own hint, so the app says "a lot for one day" only for this.
    assert.equal(error.hint, 'notes_daily_limit');
  });

  test('one insert of many rows can\'t pass the daily limit', async () => {
    const rows = (n, tag) => Array.from({ length: n }, (_, i) => note({ body: `${tag}${i}` }));
    const many = await users.burst.client.from('feedback_notes').insert(rows(25, 'b'));
    assert.ok(many.error, 'an insert of 25 at once is refused');
    assert.equal(many.error.hint, 'notes_daily_limit');
    const count = async () => (await service.from('feedback_notes').select('id', { count: 'exact', head: true }).eq('user_id', users.burst.id)).count;
    assert.equal(await count(), 0, 'none of them went in');
    const twenty = await users.burst.client.from('feedback_notes').insert(rows(20, 'c'));
    assert.ifError(twenty.error);
    const one = await users.burst.client.from('feedback_notes').insert(note());
    assert.ok(one.error, 'the 21st is refused');
    assert.equal(await count(), 20);
  });

  test('sends at the same time can\'t pass the daily limit', async () => {
    const rows = Array.from({ length: 15 }, (_, i) => ({ ...note({ body: `r${i}` }), user_id: users.racer.id }));
    assert.ifError((await service.from('feedback_notes').insert(rows)).error);
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => users.racer.client.from('feedback_notes').insert(note({ body: `race${i}` }))));
    assert.equal(results.filter((r) => !r.error).length, 5, 'only five more go in');
    const { count } = await service.from('feedback_notes').select('id', { count: 'exact', head: true }).eq('user_id', users.racer.id);
    assert.equal(count, 20);
  });

  test('a refusal that isn\'t the limit doesn\'t say it is', async () => {
    const { error } = await send('sender', { bar_id: ids.otherBar });
    assert.ok(error);
    assert.notEqual(error.hint, 'notes_daily_limit');
  });
});

describe('feedback photos', () => {
  test('the sender uploads into their own folder, not someone else\'s', async () => {
    const path = `${users.sender.id}/tell-us-${run}.png`;
    const ok = await users.sender.client.storage.from('feedback').upload(path, png, { contentType: 'image/png', upsert: false });
    assert.ifError(ok.error);
    photos.push(path);
    const wrong = await users.sender.client.storage.from('feedback').upload(`${users.other.id}/tell-us-${run}.png`, png, { contentType: 'image/png', upsert: false });
    assert.ok(wrong.error, 'uploading into another person\'s folder is refused');
  });

  test('the sender and the team can read a photo; nobody else can', async () => {
    const path = photos[0];
    const own = await users.sender.client.storage.from('feedback').download(path);
    assert.ifError(own.error);
    const team = await users.team.client.storage.from('feedback').download(path);
    assert.ifError(team.error);
    const other = await users.other.client.storage.from('feedback').download(path);
    assert.ok(other.error, 'another person can\'t download it');
    const out = await anon.storage.from('feedback').download(path);
    assert.ok(out.error, 'signed out can\'t download it');
  });

  test('the sender can\'t delete or replace a photo once sent', async () => {
    const path = photos[0];
    const sent = await send('sender', { photo_path: path });
    assert.ifError(sent.error);
    await users.sender.client.storage.from('feedback').remove([path]);
    const { data } = await service.storage.from('feedback').list(users.sender.id);
    assert.ok(data.some((f) => path.endsWith(f.name)));
    const again = await users.sender.client.storage.from('feedback').upload(path, png, { contentType: 'image/png', upsert: true });
    assert.ok(again.error, 'overwriting is refused');
  });

  test('a photo no note points at (a send that failed) can be removed by its sender, not by anyone else', async () => {
    const path = `${users.sender.id}/unsent-${run}.png`;
    assert.ifError((await users.sender.client.storage.from('feedback').upload(path, png, { contentType: 'image/png' })).error);
    photos.push(path);
    const listed = async () => (await service.storage.from('feedback').list(users.sender.id)).data.some((f) => path.endsWith(f.name));
    await users.other.client.storage.from('feedback').remove([path]);
    assert.equal(await listed(), true, 'another person can\'t remove it');
    await users.team.client.storage.from('feedback').remove([path]);
    assert.equal(await listed(), true, 'the team can\'t remove it either');
    await users.sender.client.storage.from('feedback').remove([path]);
    assert.equal(await listed(), false, 'the sender removes it');
  });

  test('an iPhone photo (HEIC or HEIF) goes in as itself', async () => {
    for (const ext of ['heic', 'heif']) {
      const path = `${users.sender.id}/iphone-${run}.${ext}`;
      const { error } = await users.sender.client.storage.from('feedback').upload(path, png, { contentType: `image/${ext}` });
      assert.ifError(error);
      photos.push(path);
    }
  });

  test('the bucket is private: no public URL serves it', async () => {
    const { data } = await db.query("SELECT public FROM storage.buckets WHERE id = 'feedback'").then((r) => ({ data: r.rows[0] }));
    assert.equal(data.public, false);
  });
});
