// A bar's public brand (supabase/migrations/20261016200000_search_bar_rows.sql):
// bar_brands gives anyone, signed out too, a public bar page's venue logo,
// accent, display face and short name, and nothing else about the venue.
// bars itself stays members only. Local stack only: `npm run test:security`.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run bar brand tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);

// Exactly what the public may see.
const PUBLIC_FIELDS = ['accent_light_color', 'display_face', 'logo_url', 'primary_color', 'profile_id', 'short_name'];
const ids = {};
let viewer;
let viewerId;

async function insert(table, row) {
  const { data, error } = await service.from(table).insert(row).select().single();
  if (error) throw new Error(`fixture insert into ${table} failed: ${error.message}`);
  return data;
}

const page = (row) => insert('profiles', { kind: 'bar', is_public: true, ...row, handle: `${row.handle}${run}`, display_name: `${row.display_name} ${run}` });

before(async () => {
  const email = `brand-viewer-${run}@bar-brands-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  viewerId = data.user.id;
  viewer = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await viewer.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;

  // A venue with every brand field set, and its private settings.
  ids.venue = (
    await insert('bars', {
      name: `Brand Venue ${run}`,
      logo_url: `https://example.test/brand-logo-${run}.png`,
      primary_color: '#D0643B',
      secondary_color: '#123456',
      ground_tint: '#141018',
      short_name: 'Brand',
      display_face: 'fraunces',
      icon_url: `https://example.test/brand-icon-${run}.png`,
      tax_rate: 10,
      target_gp: 75,
    })
  ).id;
  const hidden = async (name) => (await insert('bars', { name: `${name} ${run}`, logo_url: `https://example.test/hidden-${run}.png`, primary_color: '#2E6BD6' })).id;
  ids.hiddenVenue = await hidden('Hidden Venue');
  ids.downVenue = await hidden('Down Venue');
  ids.open = (await page({ handle: 'brandopen', display_name: 'Brand Open', bar_id: ids.venue })).id;
  ids.noVenue = (await page({ handle: 'brandnovenue', display_name: 'No Venue' })).id;
  ids.private = (await page({ handle: 'brandprivate', display_name: 'Not Public', bar_id: ids.hiddenVenue, is_public: false })).id;
  ids.moderated = (await page({ handle: 'brandmod', display_name: 'Taken Down', bar_id: ids.downVenue, moderated_at: new Date().toISOString() })).id;
});

after(async () => {
  await service.from('profiles').delete().in('id', [ids.open, ids.noVenue, ids.private, ids.moderated].filter(Boolean));
  await service.from('bars').delete().in('id', [ids.venue, ids.hiddenVenue, ids.downVenue].filter(Boolean));
  if (viewerId) await service.auth.admin.deleteUser(viewerId);
});

const all = () => [ids.open, ids.noVenue, ids.private, ids.moderated];

describe('bar_brands', () => {
  test('signed out: exactly the public fields of a public bar page with a venue, and nothing else', async () => {
    const { data, error } = await anon.rpc('bar_brands', { p_profile_ids: all() });
    assert.ifError(error);
    assert.equal(data.length, 1, 'only the public page with a venue');
    const [brand] = data;
    assert.deepEqual(Object.keys(brand).sort(), PUBLIC_FIELDS);
    assert.deepEqual(brand, {
      profile_id: ids.open,
      logo_url: `https://example.test/brand-logo-${run}.png`,
      primary_color: '#D0643B',
      accent_light_color: brand.accent_light_color,
      display_face: 'fraunces',
      short_name: 'Brand',
    });
    assert.match(brand.accent_light_color, /^#[0-9a-f]{6}$/i, 'the readable shade the database works out');
    const said = JSON.stringify(data);
    for (const secret of ['#123456', '#141018', `brand-icon-${run}`, ids.venue, `Brand Venue ${run}`]) {
      assert.ok(!said.includes(secret), `${secret} stays private`);
    }
  });

  test('signed in, not on the venue: the same public brand', async () => {
    const { data, error } = await viewer.rpc('bar_brands', { p_profile_ids: all() });
    assert.ifError(error);
    assert.deepEqual(data.map((b) => b.profile_id), [ids.open]);
    assert.deepEqual(Object.keys(data[0]).sort(), PUBLIC_FIELDS);
  });

  test('a page that is not public, or taken down, gives nothing about its venue', async () => {
    const { data } = await anon.rpc('bar_brands', { p_profile_ids: [ids.private, ids.moderated] });
    assert.deepEqual(data, []);
  });

  test('the venues themselves stay members only, and nobody outside can change them', async () => {
    for (const client of [anon, viewer]) {
      const { data } = await client.from('bars').select('*').in('id', [ids.venue, ids.hiddenVenue, ids.downVenue]);
      assert.deepEqual(data ?? [], [], 'bars_select still hides the row');
      await client.from('bars').update({ primary_color: '#000000' }).eq('id', ids.venue);
    }
    const { data } = await service.from('bars').select('primary_color').eq('id', ids.venue).single();
    assert.equal(data.primary_color, '#D0643B');
  });

  test('discover_bars stays signed-in only', async () => {
    const { error } = await anon.rpc('discover_bars', {});
    assert.ok(error, 'anon cannot call discover_bars');
  });
});
