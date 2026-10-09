// Claiming a bar page for a venue counts current Admins only
// (supabase/migrations/20261010130000_claims_current_admins.sql).
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
  throw new Error(`Refusing to run claim tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
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

/**
 * An Admin row whose venue role has ended. The schema never makes one (Admin
 * roles can't end, and a member's level follows their role), so it's written
 * with this connection's triggers off: the claim checks mustn't rely on that.
 */
async function endedAdmin(barId, userId) {
  const { rows: [role] } = await db.query(
    "INSERT INTO public.venue_roles (bar_id, name, base_level, ends_at) VALUES ($1, $2, 35, now() - interval '1 day') RETURNING id",
    [barId, `Old shift ${run}`]
  );
  await db.query("SET session_replication_role = 'replica'");
  try {
    await db.query(
      `INSERT INTO public.user_bars (bar_id, user_id, role_level, venue_role_id) VALUES ($1, $2, 40, $3)
       ON CONFLICT (user_id, bar_id) DO UPDATE SET role_level = 40, venue_role_id = EXCLUDED.venue_role_id`,
      [barId, userId, role.id]
    );
  } finally {
    await db.query("SET session_replication_role = 'origin'");
  }
}

const bar = async (name) => (await db.query('INSERT INTO public.bars (name) VALUES ($1) RETURNING id', [`${name} ${run}`])).rows[0].id;
const page = async (name) =>
  (await db.query("INSERT INTO public.profiles (kind, handle, display_name, is_public) VALUES ('bar', $1, $2, true) RETURNING id", [`${name}${run}`, `${name} ${run}`])).rows[0].id;
const claim = (who, profileId, barId) =>
  users[who].client.rpc('start_bar_claim', { p_profile_id: profileId, p_method: 'phone', p_bar_id: barId });

before(async () => {
  await db.connect();
  for (const label of ['admin', 'former']) users[label] = await makeUser(label);
  ids.bar = await bar('Lantern');
  await db.query('INSERT INTO public.user_bars (bar_id, user_id, role_level) VALUES ($1, $2, 40)', [ids.bar, users.admin.id]);
  ids.oldBar = await bar('Ember');
  await endedAdmin(ids.oldBar, users.former.id);
});

after(async () => {
  const like = `%${run}%`;
  await db.query('DELETE FROM public.profile_claims WHERE user_id = ANY($1)', [Object.values(users).map((u) => u.id)]);
  await db.query('DELETE FROM public.profiles WHERE handle LIKE $1', [like]);
  await db.query("SET session_replication_role = 'replica'");
  await db.query('DELETE FROM public.user_bars WHERE user_id = ANY($1)', [Object.values(users).map((u) => u.id)]);
  await db.query("SET session_replication_role = 'origin'");
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('linking a venue to a bar page', () => {
  test('a current Admin may', async () => {
    const { data, error } = await claim('admin', await page('lantern'), ids.bar);
    assert.ifError(error);
    assert.equal(data.bar_id, ids.bar);
  });

  test('an Admin whose venue role has ended may not', async () => {
    const { error } = await claim('former', await page('ember'), ids.oldBar);
    assert.equal(error?.code, '42501');
    assert.match(error.message, /Only an Admin of that venue/);
  });

  test('approving fails if the claimant stopped being a current Admin after claiming', async () => {
    const venue = await bar('Wick');
    await db.query('INSERT INTO public.user_bars (bar_id, user_id, role_level) VALUES ($1, $2, 40)', [venue, users.former.id]);
    const { data, error } = await claim('former', await page('wick'), venue);
    assert.ifError(error);
    await endedAdmin(venue, users.former.id);
    await assert.rejects(db.query('SELECT private.hand_over_claim($1, NULL)', [data.id]), /no longer an Admin/);
  });
});
