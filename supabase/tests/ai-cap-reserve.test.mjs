// Half the project's daily AI calls are kept for venues and established
// accounts (supabase/migrations/20261010120000_ai_cap_reserve.sql): new
// accounts share a 1,000-a-day pool inside the 2,000 ceiling.
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
  throw new Error(`Refusing to run AI cap tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const users = {};
const bars = {};
// Pays for the other calls a test pretends happened today.
let filler;

async function makeUser(label) {
  const { data, error } = await service.auth.admin.createUser({ email: `${label}-${run}@security-test.local`, email_confirm: true });
  if (error) throw error;
  return data.user.id;
}

/**
 * Tops the last 24 hours up to `total` calls, `fromNew` of them from new
 * accounts, then runs `check`, all in a rolled-back transaction so other
 * suites' AI calls never see it.
 */
async function withUsage({ total, fromNew }, check) {
  await db.query('BEGIN');
  try {
    const { rows: [now] } = await db.query(
      "SELECT count(*)::int AS total, count(*) FILTER (WHERE is_new_account)::int AS fresh FROM private.ai_usage WHERE created_at > now() - interval '24 hours'"
    );
    assert.ok(now.fresh <= fromNew && now.total - now.fresh <= total - fromNew, 'the local stack has not already used the test\'s allowance');
    await db.query("INSERT INTO private.ai_usage (user_id, fn, is_new_account) SELECT $1, 'test', true FROM generate_series(1, $2)", [filler, fromNew - now.fresh]);
    await db.query("INSERT INTO private.ai_usage (user_id, fn) SELECT $1, 'test' FROM generate_series(1, $2)", [filler, total - fromNew - (now.total - now.fresh)]);
    return await check();
  } finally {
    await db.query('ROLLBACK');
  }
}

const consume = async (who) => (await db.query("SELECT public.consume_ai_quota($1, 'test', 40) AS ok", [users[who]])).rows[0].ok;

before(async () => {
  await db.connect();
  for (const label of ['newbie', 'veteran', 'member', 'pastMember', 'moderator']) users[label] = await makeUser(label);
  filler = await makeUser('filler');
  await db.query("UPDATE auth.users SET created_at = now() - interval '30 days' WHERE id = $1", [users.veteran]);
  await db.query('INSERT INTO private.app_admins (user_id) VALUES ($1)', [users.moderator]);
  const { rows } = await db.query('INSERT INTO public.bars (name) VALUES ($1) RETURNING id', [`Pool ${run}`]);
  bars.pool = rows[0].id;
  await db.query('INSERT INTO public.user_bars (bar_id, user_id, role_level) VALUES ($1, $2, 20)', [bars.pool, users.member]);
  const { rows: [role] } = await db.query(
    "INSERT INTO public.venue_roles (bar_id, name, base_level, ends_at) VALUES ($1, $2, 20, now() - interval '1 day') RETURNING id",
    [bars.pool, `Guest shift ${run}`]
  );
  await db.query('INSERT INTO public.user_bars (bar_id, user_id, role_level, venue_role_id) VALUES ($1, $2, 20, $3)', [bars.pool, users.pastMember, role.id]);
});

after(async () => {
  await db.query('DELETE FROM private.ai_usage WHERE user_id = ANY($1)', [Object.values(users)]);
  await db.query('DELETE FROM private.app_admins WHERE user_id = $1', [users.moderator]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [`%${run}%`]);
  for (const id of [...Object.values(users), filler]) await service.auth.admin.deleteUser(id);
  await db.end();
});

describe('the new-account pool', () => {
  test('who counts as new: under a week old, no current venue role, not a catalog admin', async () => {
    const { rows } = await db.query(
      'SELECT u.label, private.ai_is_new_account(u.id) AS fresh FROM unnest($1::text[], $2::uuid[]) AS u(label, id) ORDER BY 1',
      [Object.keys(users), Object.values(users)]
    );
    assert.deepEqual(Object.fromEntries(rows.map((r) => [r.label, r.fresh])), {
      member: false, moderator: false, newbie: true, pastMember: true, veteran: false,
    });
  });

  test('a new account\'s call is marked as one', async () => {
    const marked = await withUsage({ total: 100, fromNew: 50 }, async () => {
      assert.equal(await consume('newbie'), true);
      const { rows } = await db.query('SELECT is_new_account FROM private.ai_usage WHERE user_id = $1', [users.newbie]);
      return rows.map((r) => r.is_new_account);
    });
    assert.deepEqual(marked, [true]);
  });

  test('once new accounts have used 1,000 today, only new accounts are refused', async () => {
    const got = await withUsage({ total: 1500, fromNew: 1000 }, async () =>
      Object.fromEntries(await Promise.all(['newbie', 'pastMember', 'veteran', 'member', 'moderator'].map(async (w) => [w, await consume(w)])))
    );
    assert.deepEqual(got, { newbie: false, pastMember: false, veteran: true, member: true, moderator: true });
  });

  test('below the pool, a new account is fine', async () => {
    assert.equal(await withUsage({ total: 1500, fromNew: 990 }, () => consume('newbie')), true);
  });

  test('the 2,000 ceiling still applies to everyone', async () => {
    const got = await withUsage({ total: 2000, fromNew: 0 }, async () => [await consume('veteran'), await consume('newbie')]);
    assert.deepEqual(got, [false, false]);
  });

  test('a venue\'s calls only need the overall ceiling', async () => {
    const { rows: [item] } = await db.query("INSERT INTO public.items (name, item_type, bar_id) VALUES ($1, 'cocktail', $2) RETURNING id", [`Pool sour ${run}`, bars.pool]);
    const venueCall = async () => (await db.query("SELECT public.consume_item_ai_quota($1, 'test', 50, 40) AS r", [item.id])).rows[0].r;
    assert.equal(await withUsage({ total: 1500, fromNew: 1000 }, venueCall), 'ok');
    assert.equal(await withUsage({ total: 2000, fromNew: 1000 }, venueCall), 'limit');
    await db.query('DELETE FROM public.items WHERE id = $1', [item.id]);
  });
});
