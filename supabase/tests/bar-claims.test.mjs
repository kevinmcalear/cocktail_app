// Bar claim verification: a bar proves it's theirs by its own email domain,
// a code in its Instagram bio, or a code read out on a call, and approval
// makes a venue with the claimant as Admin and the page Locked
// (supabase/migrations/20261007220000_bar_claim_verification.sql).
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
  throw new Error(`Refusing to run bar claim tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const users = {};
const pages = {};
const DOMAIN = `palemoth${run}.test`;

async function makeUser(label, email = `${label}-${run}@security-test.local`) {
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

async function barPage(key, fields = {}) {
  const { data, error } = await service
    .from('profiles')
    .insert({ kind: 'bar', handle: `${key}${run}`.toLowerCase(), display_name: `${key} ${run}`, is_public: true, ...fields })
    .select('id')
    .single();
  if (error) throw new Error(`fixture page failed: ${error.message}`);
  pages[key] = data.id;
  return data.id;
}

const claim = (who, page, method, extra = {}) =>
  users[who].client.rpc('start_bar_claim', { p_profile_id: pages[page], p_method: method, ...extra });

const pageRow = async (page) => (await db.query('SELECT bar_id, page_visibility, claimed_at FROM public.profiles WHERE id = $1', [pages[page]])).rows[0];

before(async () => {
  await db.connect();
  users.owner = await makeUser('owner', `jo-${run}@${DOMAIN}`);
  users.hotelier = await makeUser('hotelier', `sam-${run}@hotelgroup${run}.test`);
  for (const label of ['stranger', 'staff', 'caller', 'venueAdmin', 'busy', 'moderator']) users[label] = await makeUser(label);
  await db.query('INSERT INTO private.app_admins (user_id) VALUES ($1)', [users.moderator.id]);

  await barPage('Moth', { website: `https://www.${DOMAIN}/`, instagram: `palemoth${run}` });
  await barPage('Hotel', { website: `https://www.hotelgroup${run}.test/city/bar/` });
  await barPage('Closed', { website: `https://${DOMAIN}`, is_closed: true });
  await barPage('NoGram', { website: `https://www.instagram.com/nogram${run}/` });
  await barPage('Ring', {});
  await barPage('Linked', { instagram: `linked${run}` });
  for (const n of [1, 2, 3, 4]) await barPage(`Busy${n}`, { instagram: `busy${n}${run}` });
});

after(async () => {
  const ids = Object.values(users).map((u) => u.id);
  const barIds = (await db.query('SELECT bar_id FROM public.profiles WHERE id = ANY($1) AND bar_id IS NOT NULL', [Object.values(pages)])).rows.map((r) => r.bar_id);
  await db.query('DELETE FROM public.profiles WHERE id = ANY($1)', [Object.values(pages)]);
  if (barIds.length) await db.query('DELETE FROM public.bars WHERE id = ANY($1)', [barIds]);
  await db.query('DELETE FROM private.app_admins WHERE user_id = ANY($1)', [ids]);
  for (const id of ids) await service.auth.admin.deleteUser(id);
  await db.end();
});

describe('bar claim verification', () => {
  test('an email at the bar\'s own website domain claims the page on the spot, Locked, with the claimant as Admin', async () => {
    const { data, error } = await claim('owner', 'Moth', 'email', { p_note: 'Jo, bar manager' });
    assert.ifError(error);
    assert.equal(data.status, 'approved');
    assert.equal(data.method, 'email');
    assert.equal(data.code, null);
    assert.equal(data.evidence.email_domain, DOMAIN, 'the domain is kept');
    assert.ok(!JSON.stringify(data.evidence).includes(`jo-${run}`), 'the address itself is not');
    assert.equal(data.evidence.auto, true);

    const page = await pageRow('Moth');
    assert.ok(page.bar_id, 'the page has a venue');
    assert.equal(page.page_visibility, 'locked', 'and starts Locked');
    const bar = (await db.query('SELECT name, page_visibility FROM public.bars WHERE id = $1', [page.bar_id])).rows[0];
    assert.equal(bar.name, `Moth ${run}`);
    assert.equal(bar.page_visibility, 'locked');
    const role = (await db.query('SELECT role_level FROM public.user_bars WHERE bar_id = $1 AND user_id = $2', [page.bar_id, users.owner.id])).rows[0];
    assert.equal(role?.role_level, 40, 'the claimant is its Admin');
  });

  test('a claimed page cannot be claimed again', async () => {
    const { error } = await claim('stranger', 'Moth', 'instagram');
    assert.match(error?.message ?? '', /already been claimed/);
  });

  test('an email at another domain is turned away, and nothing is recorded', async () => {
    const { error } = await claim('stranger', 'Hotel', 'email');
    assert.match(error?.message ?? '', /isn't at this bar's website domain/);
    const { rows } = await db.query('SELECT 1 FROM public.profile_claims WHERE profile_id = $1', [pages.Hotel]);
    assert.equal(rows.length, 0);
  });

  test('a weaker email match waits for a moderator, with the reason', async () => {
    const hotel = await claim('hotelier', 'Hotel', 'email');
    assert.ifError(hotel.error);
    assert.equal(hotel.data.status, 'pending');
    assert.equal(hotel.data.evidence.review_reason, 'page_on_larger_site');
    assert.equal((await pageRow('Hotel')).bar_id, null);

    const closed = await claim('owner', 'Closed', 'email');
    assert.ifError(closed.error);
    assert.equal(closed.data.status, 'pending');
    assert.equal(closed.data.evidence.review_reason, 'closed_bar');
  });

  test('an Instagram claim gets a six-digit code and the handle on the page, and waits for a moderator', async () => {
    const { data, error } = await claim('staff', 'Linked', 'instagram', { p_note: 'Sam, head bartender' });
    assert.ifError(error);
    assert.equal(data.status, 'pending');
    assert.match(data.code, /^\d{6}$/);
    assert.equal(data.evidence.instagram, `linked${run}`);
    const none = await claim('staff', 'NoGram', 'instagram');
    assert.ifError(none.error, 'an instagram.com website counts as the handle');
    assert.equal(none.data.evidence.instagram, `nogram${run}`);
    const ring = await claim('stranger', 'Ring', 'instagram');
    assert.match(ring.error?.message ?? '', /no Instagram/);
  });

  test('one pending claim per bar per person', async () => {
    const { error } = await claim('staff', 'Linked', 'phone');
    assert.match(error?.message ?? '', /already have a claim waiting/);
  });

  test('evidence has no public reads: only the claimant and moderators see a claim', async () => {
    const { data: own } = await users.staff.client.from('profile_claims').select('code, evidence').eq('profile_id', pages.Linked);
    assert.equal(own.length, 1);
    assert.match(own[0].code, /^\d{6}$/);
    const { data: other } = await users.stranger.client.from('profile_claims').select('id').eq('profile_id', pages.Linked);
    assert.deepEqual(other, []);
    const { data: signedOut } = await anon.from('profile_claims').select('id').eq('profile_id', pages.Linked);
    assert.deepEqual(signedOut ?? [], []);
    const { data: mod } = await users.moderator.client.from('profile_claims').select('code').eq('profile_id', pages.Linked);
    assert.equal(mod.length, 1);
  });

  test('a claimant cannot rewrite or approve their own claim', async () => {
    const { data: rewrite } = await users.staff.client.from('profile_claims').update({ code: '000000', status: 'approved' }).eq('profile_id', pages.Linked).select('id');
    assert.deepEqual(rewrite ?? [], []);
    const { error } = await users.staff.client.rpc('approve_profile_claim', { p_claim_id: (await db.query('SELECT id FROM public.profile_claims WHERE profile_id = $1', [pages.Linked])).rows[0].id });
    assert.match(error?.message ?? '', /Only moderators/);
  });

  test('bar claims go through start_bar_claim, not a direct insert', async () => {
    const direct = await users.stranger.client.from('profile_claims').insert({ profile_id: pages.Ring, message: 'Ours' });
    assert.ok(direct.error, 'no direct bar claim');
    const sneaky = await users.stranger.client.from('profile_claims').insert({ profile_id: pages.Ring, method: 'phone', code: '123456' });
    assert.ok(sneaky.error, 'no direct code or method');
  });

  test('a phone claim is approved only with the code the bar read out', async () => {
    const { data, error } = await claim('caller', 'Ring', 'phone', { p_note: 'Call after 4pm' });
    assert.ifError(error);
    assert.match(data.code, /^\d{6}$/);
    const without = await users.moderator.client.rpc('approve_profile_claim', { p_claim_id: data.id });
    assert.match(without.error?.message ?? '', /code doesn't match/);
    const wrong = await users.moderator.client.rpc('approve_profile_claim', { p_claim_id: data.id, p_code: data.code === '000000' ? '111111' : '000000' });
    assert.match(wrong.error?.message ?? '', /code doesn't match/);
    const spoken = `${data.code.slice(0, 3)} ${data.code.slice(3)}`;
    const right = await users.moderator.client.rpc('approve_profile_claim', { p_claim_id: data.id, p_code: spoken });
    assert.ifError(right.error);
    assert.equal((await pageRow('Ring')).page_visibility, 'locked');
    const { data: mine } = await users.caller.client.from('bars').select('id, page_visibility');
    assert.equal(mine.length, 1, 'the claimant now has the venue');
    assert.equal(mine[0].page_visibility, 'locked');
  });

  test('a moderator turns a claim down with a reason the claimant sees', async () => {
    const id = (await db.query("SELECT id FROM public.profile_claims WHERE profile_id = $1 AND status = 'pending'", [pages.Hotel])).rows[0].id;
    const { data, error } = await users.moderator.client
      .from('profile_claims')
      .update({ status: 'rejected', decline_reason: 'The bio code was missing.', reviewed_by: users.moderator.id, reviewed_at: new Date().toISOString() })
      .eq('id', id)
      .select('id');
    assert.ifError(error);
    assert.equal(data.length, 1);
    const { data: seen } = await users.hotelier.client.from('profile_claims').select('status, decline_reason').eq('id', id).single();
    assert.deepEqual(seen, { status: 'rejected', decline_reason: 'The bio code was missing.' });
  });

  test('approving one claim turns down the others on that page, saying why', async () => {
    const other = await claim('stranger', 'Linked', 'phone');
    assert.ifError(other.error);
    const staffClaim = (await db.query("SELECT id FROM public.profile_claims WHERE profile_id = $1 AND user_id = $2", [pages.Linked, users.staff.id])).rows[0].id;
    const { error } = await users.moderator.client.rpc('approve_profile_claim', { p_claim_id: staffClaim });
    assert.ifError(error);
    const { data } = await users.stranger.client.from('profile_claims').select('status, decline_reason').eq('id', other.data.id).single();
    assert.equal(data.status, 'rejected');
    assert.match(data.decline_reason, /claimed this page first/);
  });

  test('an Admin can link the venue they already run, which then starts Locked', async () => {
    const bar = (await db.query("INSERT INTO public.bars (name) VALUES ($1) RETURNING id, page_visibility", [`Existing ${run}`])).rows[0];
    assert.equal(bar.page_visibility, 'open');
    await db.query('INSERT INTO public.user_bars (bar_id, user_id, role_level) VALUES ($1, $2, 40), ($1, $3, 30)', [bar.id, users.venueAdmin.id, users.busy.id]);
    const notAdmin = await claim('busy', 'Busy4', 'instagram', { p_bar_id: bar.id });
    assert.match(notAdmin.error?.message ?? '', /Only an Admin of that venue/);
    const { data, error } = await claim('venueAdmin', 'NoGram', 'instagram', { p_bar_id: bar.id });
    assert.ifError(error);
    const approved = await users.moderator.client.rpc('approve_profile_claim', { p_claim_id: data.id });
    assert.ifError(approved.error);
    assert.equal(approved.data.bar_id, bar.id);
    const after = (await db.query('SELECT page_visibility FROM public.bars WHERE id = $1', [bar.id])).rows[0];
    assert.equal(after.page_visibility, 'locked');
    await db.query('DELETE FROM public.profiles WHERE bar_id = $1', [bar.id]);
    await db.query('DELETE FROM public.bars WHERE id = $1', [bar.id]);
  });

  test('three claims a day per person', async () => {
    for (const n of [1, 2]) assert.ifError((await claim('busy', `Busy${n}`, 'instagram')).error);
    // The failed attempt above (not an Admin) left nothing behind, so this is the third.
    assert.ifError((await claim('busy', 'Busy3', 'instagram')).error);
    const fourth = await claim('busy', 'Busy4', 'instagram');
    assert.match(fourth.error?.message ?? '', /three claims today/);
  });

  test('person claims still work by direct insert, as a note', async () => {
    const person = (await service.from('profiles').insert({ kind: 'person', handle: `legend${run}`, display_name: 'Legend', is_public: true }).select('id').single()).data.id;
    pages.person = person;
    const { error } = await users.stranger.client.from('profile_claims').insert({ profile_id: person, message: 'This is me' });
    assert.ifError(error);
  });
});
