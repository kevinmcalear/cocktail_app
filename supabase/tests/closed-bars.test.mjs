// Tests for closed bars (20260930100000): a closed bar keeps its public
// page but stays out of near-me, Top bars and the city list.
//
//   supabase start && supabase db reset
//   npm run test:security
//
// Fixtures are named with a per-run id, sit in open sea near 10 S, 30 W (no
// other test file's bars land there), and are removed afterwards.

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run closed-bar tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const city = `Closedville ${run}`;
const bar = (label, extra) => ({
  kind: 'bar', handle: `${label}.${run}`, display_name: `${label} ${run}`, is_public: true,
  city, country_code: 'AU', latitude: -10, longitude: -30, is_closed: false, closed_year: null, ...extra,
});
const ids = [];

before(async () => {
  const { data, error } = await service.from('profiles')
    .insert([bar('open', {}), bar('shut', { is_closed: true, closed_year: 2019, longitude: -30.001 })])
    .select('id, handle');
  if (error) throw error;
  ids.push(...data.map((r) => r.id));
});

after(async () => {
  await service.from('profiles').delete().in('id', ids);
});

describe('closed bars', () => {
  test('near-me and Top bars leave a closed bar out', async () => {
    const { data, error } = await anon.rpc('discover_top_bars', { p_latitude: -10, p_longitude: -30, p_radius_km: 2 });
    assert.ifError(error);
    assert.deepEqual(data.map((r) => r.handle), [`open.${run}`]);
  });

  test('a city list leaves a closed bar out', async () => {
    const { data, error } = await anon.rpc('discover_top_bars', { p_city: city });
    assert.ifError(error);
    assert.deepEqual(data.map((r) => r.handle), [`open.${run}`]);
  });

  test('a closed bar keeps its public page, with the year it closed', async () => {
    const { data, error } = await anon.from('profiles').select('handle, is_closed, closed_year').eq('handle', `shut.${run}`).single();
    assert.ifError(error);
    assert.deepEqual(data, { handle: `shut.${run}`, is_closed: true, closed_year: 2019 });
  });

  test('only a bar can be closed, and a closed year means closed', async () => {
    const person = await service.from('profiles')
      .insert({ kind: 'person', handle: `person.${run}`, display_name: 'Person', is_public: true, is_closed: true });
    assert.match(person.error?.message ?? '', /profiles_closed_is_a_bar/);
    const year = await service.from('profiles').insert(bar('year', { closed_year: 2020 }));
    assert.match(year.error?.message ?? '', /profiles_closed_year_when_closed/);
  });
});
