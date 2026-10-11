// A bar's facts (20261013100000_bar_facts.sql): opening hours typed by the
// venue, phone, bar type and opened year. Anyone who can read the bar page
// reads them (signed out too); only that venue's admins and catalog admins
// write them; hours keep their shape and stamp when they changed; a
// person's profile never carries them.
// Runs against the local stack only: `npm run test:security`.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run bar facts tests against a non-local API: ${status.API_URL}`);
}

// Read the list from the hook itself, so a column added there is checked here.
const hook = readFileSync(new URL('../../hooks/useBarFacts.ts', import.meta.url), 'utf8');
const COLUMNS = hook.match(/^export const BAR_FACT_COLUMNS = '([^']+)';$/m)?.[1];

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const users = {};
const ids = {};
const HOURS = { mon: [], fri: [['16:00', '01:00']], sat: [['12:00', '15:00'], ['17:00', '02:00']] };

async function makeUser(label) {
  const email = `${label}-${run}@security-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

before(async () => {
  await db.connect();
  for (const label of ['admin', 'staff', 'stranger', 'moderator']) users[label] = await makeUser(label);
  await db.query('INSERT INTO private.app_admins (user_id) VALUES ($1)', [users.moderator.id]);
  ids.team = (await db.query('INSERT INTO public.bars (name) VALUES ($1) RETURNING id', [`Facts Team ${run}`])).rows[0].id;
  await db.query('INSERT INTO public.user_bars (bar_id, user_id, role_level) VALUES ($1, $2, 40), ($1, $3, 10)', [ids.team, users.admin.id, users.staff.id]);
  const insert = async (fields) => (await service.from('profiles').insert({ is_public: true, ...fields }).select('id').single()).data.id;
  ids.claimed = await insert({ kind: 'bar', handle: `facts${run}`, display_name: `Facts Bar ${run}`, bar_id: ids.team, address_line: '42 Gertrude St', city: 'Melbourne' });
  ids.unclaimed = await insert({ kind: 'bar', handle: `factsu${run}`, display_name: `Unclaimed ${run}` });
  ids.hidden = await insert({ kind: 'bar', handle: `factsh${run}`, display_name: `Hidden ${run}`, is_public: false, phone: '+61 3 9000 0000' });
});

after(async () => {
  await db.query('DELETE FROM public.profiles WHERE id = ANY($1)', [[ids.claimed, ids.unclaimed, ids.hidden].filter(Boolean)]);
  await db.query('DELETE FROM public.bars WHERE id = $1', [ids.team]);
  const userIds = Object.values(users).map((u) => u.id);
  await db.query('DELETE FROM private.app_admins WHERE user_id = ANY($1)', [userIds]);
  for (const id of userIds) await service.auth.admin.deleteUser(id);
  await db.end();
});

describe('bar facts', () => {
  test("useBarFacts's column list is readable from the hook", () => {
    assert.ok(COLUMNS, 'could not find `export const BAR_FACT_COLUMNS = ...` in hooks/useBarFacts.ts');
  });

  test("the venue's admin sets hours, phone, type and opened year; the hours are stamped", async () => {
    const { data, error } = await users.admin.client
      .from('profiles')
      .update({ hours: HOURS, timezone: 'Australia/Melbourne', phone: '+61 3 9419 0000', bar_type: 'Cocktail bar', opened_year: 2014 })
      .eq('id', ids.claimed)
      .select('hours, hours_updated_at, phone, bar_type, opened_year');
    assert.ifError(error);
    assert.equal(data.length, 1);
    assert.deepEqual(data[0].hours, HOURS);
    assert.ok(data[0].hours_updated_at, 'hours_updated_at is stamped');
    const before = data[0].hours_updated_at;
    // Another column's change leaves the stamp alone; a hand-set stamp is ignored.
    await db.query(`UPDATE public.profiles SET phone = '+61 3 9419 0001', hours_updated_at = '2000-01-01' WHERE id = $1`, [ids.claimed]);
    const again = (await db.query('SELECT hours_updated_at FROM public.profiles WHERE id = $1', [ids.claimed])).rows[0];
    assert.equal(again.hours_updated_at.toISOString(), new Date(before).toISOString());
  });

  test('a signed-out visitor reads every column useBarFacts selects', async () => {
    const { data, error } = await anon.from('profiles').select(COLUMNS).eq('id', ids.claimed).maybeSingle();
    assert.ifError(error);
    assert.equal(data?.bar_type, 'Cocktail bar');
    assert.equal(data.opened_year, 2014);
    assert.equal(data.address_line, '42 Gertrude St');
    assert.deepEqual(data.hours, HOURS);
  });

  test("a page that isn't public keeps its facts from everyone outside", async () => {
    const out = await anon.from('profiles').select('phone').eq('id', ids.hidden);
    assert.deepEqual(out.data, []);
    const signedIn = await users.stranger.client.from('profiles').select('phone').eq('id', ids.hidden);
    assert.deepEqual(signedIn.data, []);
  });

  test("staff below admin, strangers and signed-out visitors can't change them", async () => {
    for (const client of [users.staff.client, users.stranger.client, anon]) {
      const { data } = await client.from('profiles').update({ phone: '+1 555 0100' }).eq('id', ids.claimed).select('id');
      assert.equal(data?.length ?? 0, 0);
    }
    const row = (await db.query('SELECT phone FROM public.profiles WHERE id = $1', [ids.claimed])).rows[0];
    assert.equal(row.phone, '+61 3 9419 0001');
  });

  test("only catalog admins edit an unclaimed bar's facts", async () => {
    const theirs = await users.admin.client.from('profiles').update({ bar_type: 'Wine bar' }).eq('id', ids.unclaimed).select('id');
    assert.equal(theirs.data?.length ?? 0, 0);
    const mod = await users.moderator.client.from('profiles').update({ bar_type: 'Wine bar', hours: { tue: [['17:00', '23:00']] } }).eq('id', ids.unclaimed).select('bar_type, hours_updated_at');
    assert.ifError(mod.error);
    assert.equal(mod.data[0].bar_type, 'Wine bar');
    assert.ok(mod.data[0].hours_updated_at);
  });

  test('hours keep their shape', async () => {
    const set = (hours) => service.from('profiles').update({ hours }).eq('id', ids.unclaimed);
    for (const ok of [{}, { sun: [['20:00', '02:00']] }, { mon: [], tue: [['00:00', '23:59']] }, null]) {
      const { error } = await set(ok);
      assert.ifError(error);
    }
    for (const bad of [
      [],
      { funday: [] },
      { mon: [['17:00', '17:00']] },
      { mon: [['17:00', '24:00']] },
      { mon: [['5pm', '1am']] },
      { mon: [['17:00']] },
      { mon: [['10:00', '12:00'], ['13:00', '15:00'], ['17:00', '23:00']] },
      { mon: 'closed' },
      { mon: [[1700, 100]] },
    ]) {
      const { error } = await set(bad);
      assert.equal(error?.code, '23514', `accepted ${JSON.stringify(bad)}`);
    }
    const cleared = (await db.query('SELECT hours, hours_updated_at FROM public.profiles WHERE id = $1', [ids.unclaimed])).rows[0];
    assert.equal(cleared.hours, null);
    assert.equal(cleared.hours_updated_at, null, 'clearing the hours clears the stamp');
  });

  test('phone, type, year and zone keep their shape', async () => {
    const set = (fields) => service.from('profiles').update(fields).eq('id', ids.unclaimed);
    for (const ok of [{ phone: '(03) 9419-0000' }, { phone: '+44 20 7946 0958' }, { timezone: 'America/Argentina/Buenos_Aires' }, { timezone: 'UTC' }, { opened_year: 1862 }]) {
      const { error } = await set(ok);
      assert.ifError(error, JSON.stringify(ok));
    }
    for (const bad of [{ phone: 'call us' }, { phone: ' 0394190000' }, { phone: '12' }, { bar_type: '' }, { bar_type: 'x'.repeat(41) }, { opened_year: 3000 }, { timezone: 'Mars; DROP' }]) {
      const { error } = await set(bad);
      assert.equal(error?.code, '23514', `accepted ${JSON.stringify(bad)}`);
    }
  });

  test("a person's profile never carries a phone or hours", async () => {
    const { data } = await service.from('profiles').select('id').eq('user_id', users.stranger.id).maybeSingle();
    const personId = data?.id ?? (await service.from('profiles').insert({ kind: 'person', user_id: users.stranger.id, handle: `p${run}`, display_name: 'Person' }).select('id').single()).data.id;
    const { error } = await service.from('profiles').update({ phone: '+1 555 0100' }).eq('id', personId);
    assert.equal(error?.code, '23514');
    await db.query('DELETE FROM public.profiles WHERE id = $1', [personId]);
  });
});
