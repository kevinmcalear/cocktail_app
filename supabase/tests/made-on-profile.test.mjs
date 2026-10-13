// Made it, on your profile (20261016400000): a made_drinks log can carry a
// photo from your own upload and be shown on your profile. Others, signed in
// or out, read a log only when it's shown and its owner's profile is one they
// may see. Runs through the real API as real users, and signed out.
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
  throw new Error(`Refusing to run made-on-profile tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const users = {};
const ids = {};
const uploads = [];

async function makeUser(label) {
  const email = `${label}-${run}@security-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  await db.query("INSERT INTO private.age_checks (user_id, country_code, minimum_age, confirmed_at) VALUES ($1, 'AU', 18, now())", [data.user.id]);
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

/** An upload and its image row, the way the app records a photo (uploadDrinkPhoto). */
async function photo(client, name) {
  const path = `cocktails/${run}/made/${name}.jpg`;
  const upload = await client.storage.from('drinks').upload(path, new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), { contentType: 'image/jpeg' });
  assert.ifError(upload.error);
  uploads.push(path);
  const { data, error } = await client.from('images').insert({ url: client.storage.from('drinks').getPublicUrl(path).data.publicUrl }).select('id').single();
  assert.ifError(error);
  return data.id;
}

const log = async (client, row) => {
  const { data, error } = await client.from('made_drinks').insert(row).select('id').single();
  assert.ifError(error);
  return data.id;
};
const visible = async (client, id) => {
  const { data, error } = await client.from('made_drinks').select('id').eq('id', id);
  return error ? [] : data;
};
const onProfile = async (client, profileId) => {
  const { data, error } = await client.rpc('get_profile_made', { p_profile_id: profileId });
  assert.ifError(error);
  return data;
};

before(async () => {
  await db.connect();
  for (const label of ['maker', 'shy', 'reader', 'blocked']) users[label] = await makeUser(label);
  ids.makerProfile = (
    await serviceInsert('profiles', { kind: 'person', handle: `maker${run}`, display_name: `Maker ${run}`, user_id: users.maker.id, is_public: true })
  ).id;
  // A private profile: nothing of theirs shows, whatever a log says.
  ids.shyProfile = (
    await serviceInsert('profiles', { kind: 'person', handle: `shy${run}`, display_name: `Shy ${run}`, user_id: users.shy.id, is_public: false })
  ).id;
  await serviceInsert('user_blocks', { blocker_id: users.maker.id, blocked_id: users.blocked.id });

  ids.bar = (await serviceInsert('bars', { name: `Made Bar ${run}` })).id;
  await serviceInsert('user_bars', { user_id: users.maker.id, bar_id: ids.bar, role_level: 30 });
  ids.classic = (await serviceInsert('items', { item_type: 'cocktail', name: `Made Classic ${run}` })).id;
  ids.secret = (await serviceInsert('items', { item_type: 'cocktail', name: `House Secret ${run}`, bar_id: ids.bar })).id;

  ids.shownPhoto = await photo(users.maker.client, 'shown');
  ids.shown = await log(users.maker.client, { item_id: ids.classic, note: 'Less smoke than theirs.', image_id: ids.shownPhoto, on_profile: true });
  ids.unshown = await log(users.maker.client, { item_id: ids.classic, note: 'Just for me.' });
  ids.secretShown = await log(users.maker.client, { item_id: ids.secret, note: 'From work.', on_profile: true });
  ids.shyShown = await log(users.shy.client, { item_id: ids.classic, note: 'Private profile.', on_profile: true });
});

after(async () => {
  const like = `%${run}%`;
  await db.query('DELETE FROM public.made_drinks WHERE user_id = ANY($1)', [Object.values(users).map((u) => u.id)]);
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.images WHERE url LIKE $1', [like]);
  await service.storage.from('drinks').remove(uploads);
  await db.query('DELETE FROM public.profiles WHERE handle LIKE $1', [like]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
  await db.end();
});

describe('made_drinks on a profile', () => {
  test('a new log is off the profile by default', async () => {
    const { rows } = await db.query('SELECT on_profile FROM public.made_drinks WHERE id = $1', [ids.unshown]);
    assert.equal(rows[0].on_profile, false);
  });

  test('a shown log of a public profile reads signed in and signed out, without the owner id', async () => {
    assert.equal((await visible(users.reader.client, ids.shown)).length, 1);
    const { data, error } = await anon.from('made_drinks').select('id, item_id, note, image_id').eq('id', ids.shown);
    assert.ifError(error);
    assert.equal(data.length, 1);
    assert.ok((await anon.from('made_drinks').select('user_id').eq('id', ids.shown)).error, 'anon never reads user_id');

    for (const client of [users.reader.client, anon]) {
      const rows = await onProfile(client, ids.makerProfile);
      assert.deepEqual(
        rows.map((r) => r.id),
        [ids.shown]
      );
      assert.equal(rows[0].name, `Made Classic ${run}`);
      assert.match(rows[0].photo_url, /made\/shown\.jpg$/);
      assert.equal(rows[0].made_on, null, 'no day unless they show dates');
      assert.ok(!('user_id' in rows[0]));
    }
  });

  test('unshown logs stay private', async () => {
    assert.deepEqual(await visible(users.reader.client, ids.unshown), []);
    assert.deepEqual(await visible(anon, ids.unshown), []);
    assert.equal((await visible(users.maker.client, ids.unshown)).length, 1, 'the owner still reads it');
  });

  test('shown logs of a private profile stay private', async () => {
    assert.deepEqual(await visible(users.reader.client, ids.shyShown), []);
    assert.deepEqual(await visible(anon, ids.shyShown), []);
    assert.deepEqual(await onProfile(users.reader.client, ids.shyProfile), []);
    assert.deepEqual(await onProfile(anon, ids.shyProfile), []);
  });

  test("a shown log of a bar's private drink never shows", async () => {
    assert.deepEqual(await visible(users.reader.client, ids.secretShown), []);
    assert.deepEqual(await visible(anon, ids.secretShown), []);
  });

  test('a profile showing no drinks had, a hidden profile, or a block hides them all', async () => {
    await db.query("UPDATE public.profiles SET had_mode = 'none' WHERE id = $1", [ids.makerProfile]);
    assert.deepEqual(await visible(anon, ids.shown), []);
    await db.query("UPDATE public.profiles SET had_mode = 'picked', moderated_at = now() WHERE id = $1", [ids.makerProfile]);
    assert.deepEqual(await visible(users.reader.client, ids.shown), []);
    await db.query('UPDATE public.profiles SET moderated_at = NULL WHERE id = $1', [ids.makerProfile]);
    assert.deepEqual(await visible(users.blocked.client, ids.shown), [], 'nobody on either side of a block');
    assert.equal((await visible(users.reader.client, ids.shown)).length, 1);
  });

  test('the owner can toggle it, and nobody else can', async () => {
    const hide = await users.maker.client.from('made_drinks').update({ on_profile: false }).eq('id', ids.shown).select('id');
    assert.ifError(hide.error);
    assert.deepEqual(await visible(anon, ids.shown), []);
    const show = await users.maker.client.from('made_drinks').update({ on_profile: true }).eq('id', ids.shown).select('id');
    assert.ifError(show.error);
    assert.equal((await visible(anon, ids.shown)).length, 1);

    const sneaky = await users.reader.client.from('made_drinks').update({ on_profile: true }).eq('id', ids.unshown).select('id');
    assert.deepEqual(sneaky.data ?? [], []);
    const { rows } = await db.query('SELECT on_profile FROM public.made_drinks WHERE id = $1', [ids.unshown]);
    assert.equal(rows[0].on_profile, false);
    await anon.from('made_drinks').update({ on_profile: true }).eq('id', ids.unshown);
    assert.equal((await db.query('SELECT on_profile FROM public.made_drinks WHERE id = $1', [ids.unshown])).rows[0].on_profile, false);
  });

  test('a photo only from your own upload', async () => {
    const theirs = await photo(users.reader.client, 'theirs');
    const { error } = await users.maker.client.from('made_drinks').insert({ item_id: ids.classic, image_id: theirs });
    assert.ok(error, "someone else's upload can't be your photo");
    const swap = await users.maker.client.from('made_drinks').update({ image_id: theirs }).eq('id', ids.shown);
    assert.ok(swap.error, 'nor swapped in later');
  });

  test('a shown note is screened, a private one is not', async () => {
    const { rows } = await db.query("SELECT word FROM private.screened_words WHERE kind = 'word' LIMIT 1");
    const word = rows[0].word;
    const shown = await users.maker.client.from('made_drinks').insert({ item_id: ids.classic, note: `so ${word}`, on_profile: true });
    assert.ok(shown.error);
    const hidden = await users.maker.client.from('made_drinks').insert({ item_id: ids.classic, note: `so ${word}` }).select('id').single();
    assert.ifError(hidden.error);
    const reveal = await users.maker.client.from('made_drinks').update({ on_profile: true }).eq('id', hidden.data.id);
    assert.ok(reveal.error, 'showing it later is screened too');
  });
});
