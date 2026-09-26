// Venue staff links (/v/<slug>): every bar gets a stable, URL-safe slug, and
// signed-out visitors can look up a venue's name, logo and colours by exact
// slug, and nothing else. Runs through the real API against the local stack.
//
//   supabase start && supabase db reset
//   npm run test:security

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, describe, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run venue slug tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);

const barIds = [];

async function createBar(name) {
  const { data, error } = await service.from('bars').insert({ name }).select('id, name, slug').single();
  if (error) throw new Error(`creating bar "${name}" failed: ${error.message}`);
  barIds.push(data.id);
  return data;
}

after(async () => {
  if (barIds.length) await service.from('bars').delete().in('id', barIds);
});

describe('bar slugs', () => {
  test('come from the name, without apostrophes or punctuation', async () => {
    const bar = await createBar(`Caretaker's Cottage & Co. ${run}`);
    assert.equal(bar.slug, `caretakers-cottage-co-${run}`);
  });

  test('get a number when another bar has the same name', async () => {
    const first = await createBar(`Twin Bar ${run}`);
    const second = await createBar(`Twin Bar ${run}`);
    assert.equal(first.slug, `twin-bar-${run}`);
    assert.equal(second.slug, `twin-bar-${run}-2`);
  });

  test('fall back to "venue" when the name has no letters or digits', async () => {
    const bar = await createBar('!!!');
    assert.match(bar.slug, /^venue(-\d+)?$/);
  });

  test('stay the same when the bar is renamed, so links keep working', async () => {
    const bar = await createBar(`Old Name ${run}`);
    const { data, error } = await service
      .from('bars')
      .update({ name: `New Name ${run}` })
      .eq('id', bar.id)
      .select('slug')
      .single();
    assert.ifError(error);
    assert.equal(data.slug, bar.slug);
  });

  test('must be lowercase words joined by single dashes', async () => {
    const bar = await createBar(`Format ${run}`);
    for (const bad of ['Has Caps', 'has space', '-leading', 'double--dash', '']) {
      const { error } = await service.from('bars').update({ slug: bad }).eq('id', bar.id);
      assert.ok(error, `slug "${bad}" should be rejected`);
    }
  });
});

describe('get_venue_branding', () => {
  test('gives signed-out visitors only the name, logo, colours and home-screen identity', async () => {
    const bar = await createBar(`Branded ${run}`);
    await service
      .from('bars')
      .update({ logo_url: 'https://example.com/logo.png', primary_color: '#e74f38' })
      .eq('id', bar.id);

    const { data, error } = await anon.rpc('get_venue_branding', { p_slug: bar.slug });
    assert.ifError(error);
    assert.equal(data.length, 1);
    assert.deepEqual(Object.keys(data[0]).sort(), [
      'accent_light_color',
      'display_face',
      'ground_tint',
      'icon_url',
      'id',
      'logo_url',
      'name',
      'primary_color',
      'secondary_color',
      'short_name',
      'slug',
    ]);
    assert.equal(data[0].name, `Branded ${run}`);
    assert.equal(data[0].primary_color, '#e74f38');
  });

  test('matches the slug regardless of case', async () => {
    const bar = await createBar(`Case ${run}`);
    const { data } = await anon.rpc('get_venue_branding', { p_slug: bar.slug.toUpperCase() });
    assert.equal(data.length, 1);
  });

  test('returns nothing for unknown or partial slugs, so venues cannot be listed', async () => {
    await createBar(`Hidden ${run}`);
    for (const guess of [`hidden-${run}-x`, 'hidden', '%', '']) {
      const { data, error } = await anon.rpc('get_venue_branding', { p_slug: guess });
      assert.ifError(error);
      assert.deepEqual(data, [], `"${guess}" should match nothing`);
    }
  });

  test('does not open up the bars table to signed-out visitors', async () => {
    const bar = await createBar(`Private ${run}`);
    const { data } = await anon.from('bars').select('id').eq('id', bar.id);
    assert.deepEqual(data ?? [], []);
  });
});
