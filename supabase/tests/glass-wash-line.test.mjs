// Fit it to the glass (20261122400000_glass_wash_line.sql): a venue's glass
// carries the wash line its drinks fill it to. Its Prep sets it; its other
// staff, other venues and anyone signed out can't; anyone signed in reads it,
// as the rest of a venue's glassware. A wash line is never over the brim.
// Runs against the local stack only: `npm run test:security`.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';

const status = JSON.parse(execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run glass-wash-line tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const users = {};
const ids = {};

const OUTLINE = { height_mm: 150, rim_mm: 90, widest_mm: 93, stemmed: true, outline: [[0, 90], [10, 93], [30, 70], [45, 12]], bowl_mm: 45, stem_to_mm: 140, stem_mm: 8, foot_mm: 70 };

async function makeUser(label) {
  const email = `${label}-${run}@glass-wash-line-test.local`;
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

const washLine = async (id = ids.glass) => (await service.from('bar_glassware').select('wash_line_ml').eq('id', id).single()).data.wash_line_ml;

before(async () => {
  for (const label of ['admin', 'bartender', 'otherAdmin', 'outsider']) users[label] = await makeUser(label);
  ids.bar = (await insert('bars', { name: `Wash bar ${run}` })).id;
  ids.otherBar = (await insert('bars', { name: `Other wash bar ${run}` })).id;
  ids.page = (await insert('profiles', { kind: 'bar', handle: `washbar${run}`, display_name: `Wash bar ${run}`, bar_id: ids.bar })).id;
  ids.otherPage = (await insert('profiles', { kind: 'bar', handle: `otherwash${run}`, display_name: `Other wash bar ${run}`, bar_id: ids.otherBar })).id;
  await insert('user_bars', { user_id: users.admin.id, bar_id: ids.bar, role_level: 40 });
  await insert('user_bars', { user_id: users.bartender.id, bar_id: ids.bar, role_level: 20 });
  await insert('user_bars', { user_id: users.otherAdmin.id, bar_id: ids.otherBar, role_level: 40 });
  ids.glass = (await insert('bar_glassware', { profile_id: ids.page, glass: 'nick', name: `Nick and Nora ${run}` })).id;
  ids.traced = (await insert('bar_glassware', { profile_id: ids.page, glass: 'coupe', name: `Traced coupe ${run}`, outline: OUTLINE, capacity_ml: 180 })).id;
});

after(async () => {
  for (const id of [ids.glass, ids.traced]) if (id) await service.from('bar_glassware').delete().eq('id', id);
  for (const id of [ids.page, ids.otherPage]) if (id) await service.from('profiles').delete().eq('id', id);
  for (const id of [ids.bar, ids.otherBar]) if (id) await service.from('bars').delete().eq('id', id);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
});

describe('a venue glass’s wash line', () => {
  test('starts unsaid, so the app reads it from the glass’s capacity', async () => {
    assert.equal(await washLine(), null);
  });

  test('the venue’s Prep sets it and clears it', async () => {
    const set = await users.admin.client.from('bar_glassware').update({ wash_line_ml: 150 }).eq('id', ids.glass).select('wash_line_ml').single();
    assert.ifError(set.error);
    assert.equal(Number(set.data.wash_line_ml), 150);
    const cleared = await users.admin.client.from('bar_glassware').update({ wash_line_ml: null }).eq('id', ids.glass).select('wash_line_ml').single();
    assert.ifError(cleared.error);
    assert.equal(cleared.data.wash_line_ml, null);
    await users.admin.client.from('bar_glassware').update({ wash_line_ml: 150 }).eq('id', ids.glass);
  });

  test('its staff without Prep, another venue and anyone signed out change nothing', async () => {
    for (const who of [users.bartender.client, users.otherAdmin.client, users.outsider.client, anon]) {
      const { data } = await who.from('bar_glassware').update({ wash_line_ml: 90 }).eq('id', ids.glass).select('id');
      assert.equal(data?.length ?? 0, 0);
    }
    assert.equal(Number(await washLine()), 150);
  });

  test('anyone signed in reads it; signed out, nobody does', async () => {
    const { data, error } = await users.outsider.client.from('bar_glassware').select('wash_line_ml').eq('id', ids.glass).single();
    assert.ifError(error);
    assert.equal(Number(data.wash_line_ml), 150);
    assert.equal((await anon.from('bar_glassware').select('wash_line_ml').eq('id', ids.glass)).data?.length ?? 0, 0);
  });

  test('a sensible volume only, and never over the brim the venue typed', async () => {
    for (const bad of [0, 5, -20, 6000]) {
      assert.ok((await users.admin.client.from('bar_glassware').update({ wash_line_ml: bad }).eq('id', ids.glass)).error, `${bad} ml is refused`);
    }
    assert.ok((await users.admin.client.from('bar_glassware').update({ wash_line_ml: 190 }).eq('id', ids.traced)).error, 'over its 180 ml');
    assert.ifError((await users.admin.client.from('bar_glassware').update({ wash_line_ml: 165 }).eq('id', ids.traced)).error);
    assert.equal(Number(await washLine(ids.traced)), 165);
  });
});
