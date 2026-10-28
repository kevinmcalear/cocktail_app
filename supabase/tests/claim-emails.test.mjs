// Claim emails: a trigger on profile_claims asks the claim-email function to
// email the moderators (or the bar asked to confirm) when a claim arrives,
// and the claimant when it's decided
// (supabase/migrations/20261128400000_claim_emails.sql).
// Everything runs in one transaction that is rolled back, so the requests
// pg_net queues are read here and never sent.
// Runs against the local stack only: `npm run test:security`.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import pg from 'pg';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run claim email tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const db = new pg.Client({ connectionString: status.DB_URL });
const ids = {};
const URL = `http://claim-email-test-${run}.invalid/claim-email`;

const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];

async function user(key, meta = {}) {
  ids[key] = randomUUID();
  await db.query(
    `INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
     VALUES ($1, $2, 'authenticated', 'authenticated', $3, '{}', now(), now())`,
    [ids[key], `${key}-${run}@security-test.local`, meta],
  );
}

async function page(key, kind, fields = {}) {
  const cols = { kind, handle: `${key}${run}`.toLowerCase(), display_name: `${key} ${run}`, is_public: true, ...fields };
  const names = Object.keys(cols);
  ids[key] = (await one(`INSERT INTO public.profiles (${names.join(', ')}) VALUES (${names.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`, Object.values(cols))).id;
}

/** Runs `sql` as a signed-in user, then goes back to the owner. */
async function as(key, sql, params = []) {
  await db.query("SELECT set_config('request.jwt.claims', $1, true), set_config('role', 'authenticated', true)", [JSON.stringify({ sub: ids[key], role: 'authenticated' })]);
  try {
    return (await db.query(sql, params)).rows[0];
  } finally {
    await db.query("SELECT set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true)");
  }
}

let seen = 0;
/** The claim-email requests queued since the last call. */
async function sent() {
  const { rows } = await db.query(
    "SELECT id, headers, convert_from(body, 'UTF8')::jsonb AS body FROM net.http_request_queue WHERE url = $1 AND id > $2 ORDER BY id",
    [URL, seen],
  );
  if (rows.length) seen = rows.at(-1).id;
  return rows.map((r) => r.body);
}

before(async () => {
  await db.connect();
  await db.query('BEGIN');
  // This test's own target, so nothing queued here could reach a real function.
  await db.query("DELETE FROM vault.secrets WHERE name IN ('claim_email_url', 'claim_email_secret')");
  await db.query("SELECT vault.create_secret($1, 'claim_email_url'), vault.create_secret('test-secret', 'claim_email_secret')", [URL]);
  seen = (await one('SELECT coalesce(max(id), 0) AS id FROM net.http_request_queue')).id;

  await user('mod');
  await user('ash', { full_name: 'Ash Grey' });
  await user('jo');
  await user('cal', { first_name: 'Cal', last_name: 'Byrne' });
  await user('admin');
  await db.query('INSERT INTO private.app_admins (user_id) VALUES ($1)', [ids.mod]);
  ids.venue = (await one('INSERT INTO public.bars (name) VALUES ($1) RETURNING id', [`Moth ${run}`])).id;
  await page('Moth', 'bar', { bar_id: ids.venue });
  await page('Jo', 'person', { user_id: ids.jo });
  await page('Ash', 'person');
  await page('Cal', 'person');
  for (const person of ['Ash', 'Cal']) {
    await db.query("INSERT INTO public.profile_positions (person_profile_id, bar_profile_id, title, is_current) VALUES ($1, $2, 'Bartender', true)", [ids[person], ids.Moth]);
  }
  await db.query('INSERT INTO public.user_bars (user_id, bar_id, role_level) VALUES ($1, $2, 40)', [ids.admin, ids.venue]);
});

after(async () => {
  await db.query('ROLLBACK');
  await db.end();
});

test('a claim arrives: the moderators hear who, which page, how, and the note', async () => {
  ids.ashClaim = (await as('ash', "SELECT id FROM public.start_person_claim($1, 'note', 'I ran the bar.')", [ids.Ash])).id;
  const [mail, ...more] = await sent();
  assert.equal(more.length, 0);
  assert.equal(mail.event, 'arrived');
  // Every moderator (a stack may have others), never the claimant.
  assert.ok(mail.to.includes(ids.mod));
  assert.ok(!mail.to.includes(ids.ash));
  assert.equal(mail.to_bar, false);
  assert.equal(mail.claimant, 'Ash Grey');
  assert.equal(mail.page.name, `Ash ${run}`);
  assert.equal(mail.page.kind, 'person');
  assert.equal(mail.method, 'note');
  assert.equal(mail.note, 'I ran the bar.');
});

test('the request carries the shared secret', async () => {
  const { rows } = await db.query('SELECT headers FROM net.http_request_queue WHERE url = $1 LIMIT 1', [URL]);
  assert.equal(rows[0].headers['x-claim-email-secret'], 'test-secret');
});

test('a person asking the bar: its current Admins hear instead, unless a rival claim waits', async () => {
  ids.calClaim = (await as('cal', 'SELECT id FROM public.start_person_claim($1, $2, NULL, NULL, $3)', [ids.Cal, 'note', ids.Moth])).id;
  const [toBar] = await sent();
  assert.deepEqual(toBar.to, [ids.admin], 'not the moderators');
  assert.equal(toBar.to_bar, true);
  assert.equal(toBar.claimant, 'Cal Byrne');
  assert.equal(toBar.confirm_bar.venue_id, ids.venue);

  // Jo has a profile already; their name comes from it. Ash's claim waits, so a moderator decides.
  ids.joClaim = (await as('jo', 'SELECT id FROM public.start_person_claim($1, $2, NULL, NULL, $3)', [ids.Ash, 'note', ids.Moth])).id;
  const [rival] = await sent();
  assert.ok(rival.to.includes(ids.mod));
  assert.equal(rival.to_bar, false);
  assert.equal(rival.claimant, `Jo ${run}`);
  assert.equal(rival.confirm_bar.name, `Moth ${run}`);
});

test('approved: the claimant hears; the rival claim closed with it hears too', async () => {
  await db.query('SELECT private.hand_over_claim($1, $2)', [ids.ashClaim, ids.mod]);
  const mails = await sent();
  assert.equal(mails.length, 2);
  const approved = mails.find((m) => m.event === 'approved');
  const rival = mails.find((m) => m.event === 'rejected');
  assert.deepEqual(approved.to, [ids.ash]);
  assert.equal(approved.page.name, `Ash ${run}`);
  assert.deepEqual(rival.to, [ids.jo]);
  assert.equal(rival.rival, true);
});

test('turned down by a moderator: the claimant hears why', async () => {
  await db.query("UPDATE public.profile_claims SET status = 'rejected', decline_reason = 'We could not reach you.', reviewed_by = $2, reviewed_at = now() WHERE id = $1", [ids.calClaim, ids.mod]);
  const [mail, ...more] = await sent();
  assert.equal(more.length, 0);
  assert.equal(mail.event, 'rejected');
  assert.deepEqual(mail.to, [ids.cal]);
  assert.equal(mail.rival, false);
  assert.equal(mail.decline_reason, 'We could not reach you.');
});

test('other changes to a claim send nothing', async () => {
  await db.query("UPDATE public.profile_claims SET message = 'edited' WHERE id = $1", [ids.calClaim]);
  assert.equal((await sent()).length, 0);
});

test('a bar claim approved on the spot sends nothing', async () => {
  await page('Spot', 'bar');
  const claim = await one(
    `INSERT INTO public.profile_claims (profile_id, user_id, method, evidence) VALUES ($1, $2, 'email', '{"auto": true}') RETURNING id`,
    [ids.Spot, ids.cal],
  );
  await db.query('SELECT private.hand_over_claim($1, NULL)', [claim.id]);
  assert.equal((await sent()).length, 0);
});

test('with no Vault secrets it does nothing, and a claim still saves', async () => {
  await db.query("DELETE FROM vault.secrets WHERE name = 'claim_email_url'");
  await page('Quiet', 'person');
  await user('quiet');
  const row = await as('quiet', "SELECT id FROM public.start_person_claim($1, 'note')", [ids.Quiet]);
  assert.ok(row.id);
  assert.equal((await sent()).length, 0);
});
