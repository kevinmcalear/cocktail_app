// Daily limits on invites, invite emails, new venues and AI calls; venue
// writes by current Admins only; memberships only through the app's own
// functions; drinks bucket reads; image URLs; table privileges
// (supabase/migrations/20261008700000_daily_limits_and_venue_roles.sql and
// 20261008710000_storage_images_grants.sql).
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
  throw new Error(`Refusing to run daily limit tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const users = {};
const bars = {};
const uploaded = [];
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

async function makeUser(label) {
  const email = `${label}-${run}@security-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, email, client };
}

async function makeBar(key, members) {
  const { rows } = await db.query('INSERT INTO public.bars (name) VALUES ($1) RETURNING id', [`${key} ${run}`]);
  bars[key] = rows[0].id;
  for (const [label, level] of members) {
    await db.query('INSERT INTO public.user_bars (bar_id, user_id, role_level) VALUES ($1, $2, $3)', [bars[key], users[label].id, level]);
  }
  return bars[key];
}

/** Today's events of a kind, as if they had already happened. */
async function prefill(kind, count, { userId = null, barId = null, subject = null } = {}) {
  await db.query(
    'INSERT INTO private.rate_events (kind, user_id, bar_id, subject) SELECT $1, $2, $3, $4 FROM generate_series(1, $5)',
    [kind, userId, barId, subject, count]
  );
}

const invite = (who, barKey, email, level = 20) =>
  users[who].client.rpc('add_user_to_bar_by_email', { p_email: email, p_bar_id: bars[barKey], p_role_level: level });

const newVenue = (who, name) =>
  users[who].client.rpc('create_new_bar', {
    p_name: `${name} ${run}`, p_visibility: 10, p_generic: 20, p_specific: 30, p_measurement: 30, p_prep: 40,
  });

before(async () => {
  await db.connect();
  for (const label of ['admin', 'coAdmin', 'creator', 'pastCreator', 'member', 'outsider', 'busy', 'moderator', 'founder']) {
    users[label] = await makeUser(label);
  }
  await db.query('INSERT INTO private.app_admins (user_id) VALUES ($1)', [users.moderator.id]);
  await makeBar('Limits', [['admin', 40], ['coAdmin', 40], ['creator', 35], ['member', 20]]);
  await makeBar('Crowded', [['busy', 40]]);

  // A Drink Creator whose venue role has ended (Admin roles never end).
  const { rows } = await db.query(
    "INSERT INTO public.venue_roles (bar_id, name, base_level, ends_at) VALUES ($1, $2, 35, now() - interval '1 day') RETURNING id",
    [bars.Limits, `Guest shift ${run}`]
  );
  await db.query('INSERT INTO public.user_bars (bar_id, user_id, role_level, venue_role_id) VALUES ($1, $2, 35, $3)', [
    bars.Limits, users.pastCreator.id, rows[0].id,
  ]);
});

after(async () => {
  if (uploaded.length) await service.storage.from('drinks').remove(uploaded);
  const ids = Object.values(users).map((u) => u.id);
  await db.query('DELETE FROM private.rate_events WHERE user_id = ANY($1) OR bar_id = ANY($2)', [ids, Object.values(bars)]);
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [`%${run}%`]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [`%${run}%`]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('invites', () => {
  test('an Admin stops at 20 invites a day, with a message the app shows', async () => {
    await prefill('invite', 19, { userId: users.admin.id, barId: bars.Crowded });
    const { error: last } = await invite('admin', 'Limits', `twentieth-${run}@example.test`);
    assert.ifError(last);
    const { error } = await invite('admin', 'Limits', `twentyfirst-${run}@example.test`);
    assert.equal(error?.code, 'P0001');
    assert.match(error.message, /You've sent 20 invites today/);
  });

  test('changing a current member\'s role is not an invite and is never limited', async () => {
    const { data, error } = await invite('admin', 'Limits', users.member.email, 30);
    assert.ifError(error);
    assert.equal(data.role_level, 30);
  });

  test('a venue stops at 50 invites a day across all its Admins', async () => {
    await prefill('invite', 49, { userId: users.creator.id, barId: bars.Limits });
    // The Admin's 20 are spent above, so the co-Admin sends the venue's last.
    const before = Number((await db.query("SELECT count(*) FROM private.rate_events WHERE kind = 'invite' AND bar_id = $1", [bars.Limits])).rows[0].count);
    assert.ok(before >= 50, 'the venue is already at its limit');
    const { error } = await invite('coAdmin', 'Limits', `fiftyfirst-${run}@example.test`);
    assert.equal(error?.code, 'P0001');
    assert.match(error.message, /This venue has sent 50 invites today/);
  });

  test('cancelling an invite does not hand the allowance back', async () => {
    await db.query('DELETE FROM public.bar_invites WHERE bar_id = $1', [bars.Limits]);
    const { error } = await invite('admin', 'Limits', `again-${run}@example.test`);
    assert.match(error?.message ?? '', /You've sent 20 invites today/);
  });

  test('app moderators are not limited', async () => {
    await db.query('INSERT INTO public.user_bars (bar_id, user_id, role_level) VALUES ($1, $2, 40)', [bars.Crowded, users.moderator.id]);
    await prefill('invite', 60, { userId: users.moderator.id, barId: bars.Crowded });
    const { error } = await invite('moderator', 'Crowded', `mod-${run}@example.test`);
    assert.ifError(error);
  });
});

describe('invite emails', () => {
  const slot = (sender, barKey, email) =>
    service.rpc('take_invite_email_slot', { p_sender: users[sender].id, p_bar_id: bars[barKey], p_email: email });

  test('only the service role can take a slot', async () => {
    const { error } = await users.busy.client.rpc('take_invite_email_slot', {
      p_sender: users.busy.id, p_bar_id: bars.Crowded, p_email: `x-${run}@example.test`,
    });
    assert.ok(error);
  });

  test('one invite is emailed at most 3 times a day', async () => {
    const email = `thrice-${run}@example.test`;
    for (let i = 0; i < 3; i++) assert.equal((await slot('busy', 'Crowded', email)).data, 'ok');
    assert.equal((await slot('busy', 'Crowded', email)).data, 'invite');
    assert.equal((await slot('busy', 'Crowded', `other-${run}@example.test`)).data, 'ok', 'another invite still goes');
  });

  test('one Admin sends at most 30 invite emails a day', async () => {
    await prefill('invite_email', 26, { userId: users.busy.id, barId: bars.Crowded, subject: `filler-${run}@example.test` });
    assert.equal((await slot('busy', 'Crowded', `last-${run}@example.test`)).data, 'sender');
  });
});

describe('new venues', () => {
  test('three a day per person, then a readable refusal', async () => {
    for (const name of ['First', 'Second', 'Third']) {
      const { error } = await newVenue('founder', name);
      assert.ifError(error);
    }
    const { error } = await newVenue('founder', 'Fourth');
    assert.equal(error?.code, 'P0001');
    assert.match(error.message, /You've made 3 venues today/);
  });

  test('deleting a venue does not hand the allowance back', async () => {
    await db.query('DELETE FROM public.bars WHERE name = $1', [`First ${run}`]);
    const { error } = await newVenue('founder', 'Fifth');
    assert.match(error?.message ?? '', /You've made 3 venues today/);
  });

  test('another person is unaffected', async () => {
    const { error } = await newVenue('outsider', 'Own place');
    assert.ifError(error);
  });
});

describe('the project-wide AI ceiling', () => {
  // Tops the project's last 24 hours up to `total` calls, in a rolled-back
  // transaction so other suites' AI calls never see it. Totals stay 20 clear
  // of the 2,000 ceiling: suites running alongside add and refund calls.
  async function withProjectUsage(total, check) {
    await db.query('BEGIN');
    try {
      const { rows } = await db.query("SELECT count(*)::int AS n FROM private.ai_usage WHERE created_at > now() - interval '24 hours'");
      assert.ok(rows[0].n <= total, 'the local stack has not already used the test\'s allowance');
      await db.query("INSERT INTO private.ai_usage (bar_id, fn) SELECT $1, 'test' FROM generate_series(1, $2)", [bars.Crowded, total - rows[0].n]);
      return await check();
    } finally {
      await db.query('ROLLBACK');
    }
  }

  test('a person with their own allowance left is refused once the project has used 2,000 today', async () => {
    const consume = () =>
      db.query("SELECT public.consume_ai_quota($1, 'test', 40) AS ok", [users.member.id]).then((r) => r.rows[0].ok);
    assert.equal(await withProjectUsage(1980, consume), true);
    assert.equal(await withProjectUsage(2020, consume), false);
  });

  test('a venue\'s automatic AI calls stop at the ceiling too', async () => {
    const consume = async () => {
      const { rows } = await db.query("INSERT INTO public.items (name, item_type, bar_id) VALUES ($1, 'cocktail', $2) RETURNING id", [
        `Ceiling sour ${run}`, bars.Limits,
      ]);
      return (await db.query("SELECT public.consume_item_ai_quota($1, 'test', 50, 40) AS r", [rows[0].id])).rows[0].r;
    };
    assert.equal(await withProjectUsage(10, consume), 'ok');
    assert.equal(await withProjectUsage(2020, consume), 'limit');
  });
});

describe('venue writes need a current Admin', () => {
  const settings = (who) =>
    users[who].client.rpc('update_bar_settings', {
      p_bar_id: bars.Limits, p_name: `Limits ${run}`, p_visibility: 10, p_generic: 20, p_specific: 30, p_measurement: 30, p_prep: 40,
    });

  test('update_bar_settings: a current Admin yes; not a Drink Creator, current or ended', async () => {
    assert.ifError((await settings('admin')).error);
    for (const who of ['creator', 'pastCreator', 'outsider']) {
      const { error } = await settings(who);
      assert.match(error?.message ?? '', /must be a bar Admin/, who);
    }
  });

  test('assign_item_to_bar: a current Admin moves their own item in; a Drink Creator cannot', async () => {
    const own = async (who) =>
      (await db.query("INSERT INTO public.items (name, item_type, created_by) VALUES ($1, 'ingredient', $2) RETURNING id", [
        `${who} syrup ${run}`, users[who].id,
      ])).rows[0].id;
    for (const who of ['creator', 'pastCreator']) {
      const { error } = await users[who].client.rpc('assign_item_to_bar', { p_item_id: await own(who), p_bar_id: bars.Limits });
      assert.match(error?.message ?? '', /must be a bar Admin/, who);
    }
    const { data, error } = await users.admin.client.rpc('assign_item_to_bar', { p_item_id: await own('admin'), p_bar_id: bars.Limits });
    assert.ifError(error);
    assert.equal(data.bar_id, bars.Limits);
  });
});

describe('memberships', () => {
  test('an Admin cannot add someone by inserting a membership', async () => {
    const { error } = await users.admin.client.from('user_bars').insert({ user_id: users.outsider.id, bar_id: bars.Limits, role_level: 40 });
    assert.ok(error);
    const { rows } = await db.query('SELECT 1 FROM public.user_bars WHERE user_id = $1 AND bar_id = $2', [users.outsider.id, bars.Limits]);
    assert.equal(rows.length, 0);
  });

  test('an Admin cannot hand someone\'s membership to another person or venue', async () => {
    const client = users.admin.client;
    const { error: userError } = await client.from('user_bars').update({ user_id: users.outsider.id }).eq('bar_id', bars.Limits).eq('user_id', users.member.id);
    assert.ok(userError);
    const { error: barError } = await client.from('user_bars').update({ bar_id: bars.Crowded }).eq('bar_id', bars.Limits).eq('user_id', users.member.id);
    assert.ok(barError);
    const { rows } = await db.query('SELECT bar_id FROM public.user_bars WHERE user_id = $1', [users.member.id]);
    assert.deepEqual(rows.map((r) => r.bar_id), [bars.Limits]);
  });

  test('an Admin still changes a member\'s role directly', async () => {
    const { data, error } = await users.admin.client
      .from('user_bars').update({ role_level: 20 }).eq('bar_id', bars.Limits).eq('user_id', users.member.id).select('role_level');
    assert.ifError(error);
    assert.deepEqual(data, [{ role_level: 20 }]);
  });
});

describe('the drinks bucket', () => {
  const path = `cocktails/${run}/listed.png`;

  before(async () => {
    const { error } = await users.member.client.storage.from('drinks').upload(path, png, { contentType: 'image/png', upsert: false });
    assert.ifError(error);
    uploaded.push(path);
  });

  test('nobody else can list it, signed in or out', async () => {
    for (const client of [anon, users.outsider.client]) {
      const { data } = await client.storage.from('drinks').list(`cocktails/${run}`);
      assert.deepEqual(data ?? [], []);
    }
  });

  test('the uploader sees their own file, and its public URL still serves', async () => {
    const { data } = await users.member.client.storage.from('drinks').list(`cocktails/${run}`);
    assert.deepEqual(data.map((f) => f.name), ['listed.png']);
    const url = service.storage.from('drinks').getPublicUrl(path).data.publicUrl;
    const res = await fetch(url);
    assert.equal(res.status, 200);
    await res.arrayBuffer();
  });

  test('another person still cannot overwrite it', async () => {
    const { error } = await users.outsider.client.storage.from('drinks').upload(path, png, { contentType: 'image/png', upsert: true });
    assert.ok(error);
  });
});

describe('image rows', () => {
  test('a client records a picture in the drinks bucket, nothing else', async () => {
    const client = users.member.client;
    const good = service.storage.from('drinks').getPublicUrl(`cocktails/${run}/listed.png`).data.publicUrl;
    const { data, error } = await client.from('images').insert({ url: good }).select('id').single();
    assert.ifError(error);
    await db.query('DELETE FROM public.images WHERE id = $1', [data.id]);

    for (const url of [
      `https://example.com/${run}.png`,
      `${status.API_URL}/storage/v1/object/public/avatars/${run}.png`,
      `${status.API_URL}/storage/v1/object/public/drinks/../avatars/${run}.png`,
      `${status.API_URL}/storage/v1/object/public/drinks/%2e%2e/${run}.png`,
      `https://other.supabase.co/storage/v1/object/public/drinks/${run}.png`,
      `javascript:alert(1)//storage/v1/object/public/drinks/${run}.png`,
    ]) {
      const { error: badError } = await client.from('images').insert({ url });
      assert.ok(badError, url);
    }
  });
});

describe('table privileges', () => {
  test('anon and authenticated hold no TRUNCATE, TRIGGER or REFERENCES on public tables', async () => {
    const { rows } = await db.query(`
      SELECT table_name, grantee, privilege_type FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
        AND privilege_type IN ('TRUNCATE', 'TRIGGER', 'REFERENCES')`);
    assert.deepEqual(rows, []);
  });

  test('a table made by a later migration does not get them either, but keeps the usual ones', async () => {
    await db.query('BEGIN');
    try {
      await db.query(`CREATE TABLE public.privilege_probe_${run} (id int)`);
      const { rows } = await db.query(
        `SELECT has_table_privilege('anon', $1, 'TRUNCATE') AS t, has_table_privilege('authenticated', $1, 'REFERENCES') AS r,
                has_table_privilege('authenticated', $1, 'TRIGGER') AS g, has_table_privilege('authenticated', $1, 'SELECT') AS s`,
        [`public.privilege_probe_${run}`]
      );
      assert.deepEqual(rows[0], { t: false, r: false, g: false, s: true });
    } finally {
      await db.query('ROLLBACK');
    }
  });
});
