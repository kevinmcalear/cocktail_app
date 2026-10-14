// Readable shared links (supabase/migrations/20261016300000_share_slugs.sql):
// share_slug() and share_target(), and that a slug never gives away a drink or
// menu that isn't public. Runs against the local stack only: `npm run test:security`.
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
  throw new Error(`Refusing to run share slug tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

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

async function serviceInsert(table, row) {
  const { data, error } = await service.from(table).insert(row).select().single();
  if (error) throw new Error(`fixture insert into ${table} failed: ${error.message}`);
  return data;
}

const slugFor = async (client, kind, id) => {
  const { data, error } = await client.rpc('share_slug', { p_kind: kind, p_id: id });
  assert.ifError(error);
  return data;
};
const target = async (client, kind, slug) => {
  const { data, error } = await client.rpc('share_target', { p_kind: kind, p_slug: slug });
  assert.ifError(error);
  return data;
};
const stored = async (id) => (await db.query('SELECT slug FROM private.share_slugs WHERE item_id = $1 OR menu_id = $1', [id])).rows;

before(async () => {
  await db.connect();
  for (const label of ['owner', 'other', 'stranger']) users[label] = await makeUser(label);
  for (const label of ['owner', 'other']) {
    await serviceInsert('profiles', { kind: 'person', handle: `${label}${run}`, display_name: `${label} ${run}`, user_id: users[label].id, is_public: true });
  }
  const item = async (row) => (await serviceInsert('items', { item_type: 'cocktail', ...row })).id;
  ids.published = await item({ name: `Porch Sour ${run}`, created_by: users.owner.id, publish_mode: 'description' });
  ids.twin = await item({ name: `Porch Sour ${run}`, created_by: users.other.id, publish_mode: 'description' });
  ids.private = await item({ name: `Secret Negroni ${run}`, created_by: users.owner.id });
  ids.unpublished = await item({ name: `Gone Fizz ${run}`, created_by: users.owner.id, publish_mode: 'description' });

  const menu = await users.owner.client.from('menus').insert({ name: `Halloween party ${run}`, bar_id: null }).select('id').single();
  assert.ifError(menu.error);
  ids.menu = menu.data.id;
});

after(async () => {
  const like = `%${run}%`;
  await db.query('DELETE FROM public.user_blocks WHERE blocker_id = $1 OR blocked_id = $1', [users.owner.id]);
  await db.query('DELETE FROM public.menus WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.profiles WHERE handle LIKE $1', [like]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('making a slug', () => {
  test('lower case words joined by hyphens', async () => {
    const cases = {
      Penicillin: 'penicillin',
      "Bee's Knees": 'bees-knees',
      'Bee’s Knees': 'bees-knees',
      'Gin & Tonic': 'gin-and-tonic',
      'Añejo Highball': 'anejo-highball',
      'Negroni Nórdico': 'negroni-nordico',
      'Straße Fizz': 'strasse-fizz',
      '  Halloween   party!! ': 'halloween-party',
      'Negroni (1929)': 'negroni-1929',
      '日本': 'drink',
      '0c2bead3-1ed9-4b1d-b79d-073f85eef5d2': 'drink-0c2bead3-1ed9-4b1d-b79d-073f85eef5d2',
      [`${'verylongword '.repeat(10)}`]: 'verylongword-verylongword-verylongword-verylongword',
    };
    for (const [name, slug] of Object.entries(cases)) {
      const { rows } = await db.query("SELECT private.share_slug_base($1, 'd') AS slug", [name]);
      assert.equal(rows[0].slug, slug, name);
    }
    const { rows } = await db.query("SELECT private.share_slug_base('', 'm') AS slug");
    assert.equal(rows[0].slug, 'menu');
  });

  test('a published drink gets its name, a second one a short suffix, and both resolve', async () => {
    const base = `porch-sour-${run}`;
    assert.equal(await slugFor(users.owner.client, 'd', ids.published), base);
    // Asking again, by anyone signed in, gives the same slug.
    assert.equal(await slugFor(users.stranger.client, 'd', ids.published), base);
    const twin = await slugFor(users.other.client, 'd', ids.twin);
    assert.equal(twin, `${base}-${ids.twin.replace(/-/g, '').slice(0, 4)}`);

    assert.equal(await target(anon, 'd', base), ids.published);
    assert.equal(await target(anon, 'd', twin), ids.twin);
    // Case doesn't matter in a typed link; the kind does.
    assert.equal(await target(anon, 'd', base.toUpperCase()), ids.published);
    assert.equal(await target(anon, 'm', base), null);
  });

  test('renaming keeps the link', async () => {
    const before = await slugFor(users.owner.client, 'd', ids.published);
    const { error } = await users.owner.client.from('items').update({ name: `Porch Sour Deluxe ${run}` }).eq('id', ids.published);
    assert.ifError(error);
    assert.equal(await slugFor(users.owner.client, 'd', ids.published), before);
    assert.equal(await target(anon, 'd', before), ids.published);
  });
});

describe('a slug never gives away what is not public', () => {
  test('a private drink gets no slug, even asked by its owner', async () => {
    assert.equal(await slugFor(users.owner.client, 'd', ids.private), null);
    assert.deepEqual(await stored(ids.private), []);
  });

  test("a private drink's slug resolves for nobody, not even its owner", async () => {
    // As if it had been published once: the slug stays, the link stops.
    const slug = `secret-negroni-${run}`;
    await db.query("INSERT INTO private.share_slugs (kind, slug, item_id) VALUES ('d', $1, $2)", [slug, ids.private]);
    for (const client of [anon, users.stranger.client, users.owner.client]) assert.equal(await target(client, 'd', slug), null);
    // The answer is the same as a slug nobody has.
    assert.equal(await target(anon, 'd', `no-such-drink-${run}`), null);
  });

  test('unpublishing stops the link; the slug comes back if it is published again', async () => {
    const slug = await slugFor(users.owner.client, 'd', ids.unpublished);
    assert.equal(slug, `gone-fizz-${run}`);
    assert.equal(await target(anon, 'd', slug), ids.unpublished);
    await db.query("UPDATE public.items SET publish_mode = 'private' WHERE id = $1", [ids.unpublished]);
    assert.equal(await target(anon, 'd', slug), null);
    assert.equal(await target(users.stranger.client, 'd', slug), null);
    assert.equal(await slugFor(users.owner.client, 'd', ids.unpublished), null);
    await db.query("UPDATE public.items SET publish_mode = 'description' WHERE id = $1", [ids.unpublished]);
    assert.equal(await target(anon, 'd', slug), ids.unpublished);
  });

  test('a block hides the drink behind a slug, as it hides the drink', async () => {
    const slug = await slugFor(users.owner.client, 'd', ids.published);
    await serviceInsert('user_blocks', { blocker_id: users.owner.id, blocked_id: users.stranger.id });
    assert.equal(await target(users.stranger.client, 'd', slug), null);
    assert.equal(await target(anon, 'd', slug), ids.published);
    await db.query('DELETE FROM public.user_blocks WHERE blocker_id = $1', [users.owner.id]);
  });

  test('nobody reads or writes the slugs directly, and signed out nobody makes one', async () => {
    const anonMake = await anon.rpc('share_slug', { p_kind: 'd', p_id: ids.published });
    assert.ok(anonMake.error, 'anon cannot make slugs');
    for (const client of [anon, users.owner.client]) {
      const read = await client.schema('private').from('share_slugs').select('*');
      assert.ok(read.error, 'the private schema is not served');
    }
    for (const role of ['anon', 'authenticated']) {
      const { rows } = await db.query("SELECT has_table_privilege($1, 'private.share_slugs', 'SELECT, INSERT, UPDATE, DELETE') AS any", [role]);
      assert.equal(rows[0].any, false, role);
    }
  });

  test('odd input is no match, not an error', async () => {
    for (const slug of ["x' or 1=1", '', '../etc/passwd', ids.published]) assert.equal(await target(anon, 'd', slug), null, slug);
    assert.equal(await target(anon, 'x', `porch-sour-${run}`), null);
    assert.equal(await slugFor(users.owner.client, 'x', ids.published), null);
  });
});

describe('a shared menu', () => {
  test('gets a slug once shared, keeps it through unsharing, and resolves only while shared', async () => {
    assert.equal(await slugFor(users.owner.client, 'm', ids.menu), null);
    const share = (on) => users.owner.client.from('menus').update({ shared_at: on ? '2001-01-01T00:00:00Z' : null }).eq('id', ids.menu);
    assert.ifError((await share(true)).error);
    const slug = await slugFor(users.owner.client, 'm', ids.menu);
    assert.equal(slug, `halloween-party-${run}`);
    assert.equal(await target(anon, 'm', slug), ids.menu);
    assert.equal(await target(anon, 'd', slug), null);

    assert.ifError((await share(false)).error);
    assert.equal(await target(anon, 'm', slug), null);
    assert.equal(await slugFor(users.owner.client, 'm', ids.menu), null);

    assert.ifError((await share(true)).error);
    assert.equal(await slugFor(users.owner.client, 'm', ids.menu), slug);
    assert.equal(await target(anon, 'm', slug), ids.menu);
  });
});
