// Why it works (20261008130000_pair_notes.sql): only the service role takes
// pairs to note and saves notes, an editor's note is never replaced, and
// anyone reads a note for any two ingredients (each read as its core one).
//
//   supabase start && supabase db reset
//   npm run test:security

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
  throw new Error(`Refusing to run pair note tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });
const ids = {};

async function ingredient(name, extra = {}) {
  const { rows } = await db.query(`INSERT INTO public.items (name, item_type, is_core, generic_id) VALUES ($1, 'ingredient', $2, $3) RETURNING id`, [
    name,
    extra.core ?? false,
    extra.generic ?? null,
  ]);
  return rows[0].id;
}

before(async () => {
  await db.connect();
  ids.a = await ingredient(`Note Smoke ${run}`, { core: true });
  ids.b = await ingredient(`Note Sweet ${run}`, { core: true });
  ids.c = await ingredient(`Note Sour ${run}`, { core: true });
  ids.brand = await ingredient(`Note Smoke Brand ${run}`, { generic: ids.a });
});

after(async () => {
  await db.query('DELETE FROM public.items WHERE id = ANY($1::uuid[])', [[ids.brand, ids.a, ids.b, ids.c]]);
  await db.end();
});

describe('pair notes', () => {
  test('only the service role takes pairs and saves notes', async () => {
    const next = await anon.rpc('next_pair_notes', { p_limit: 5 });
    assert.ok(next.error, 'anon cannot read the queue');
    const save = await anon.rpc('save_pair_notes', { p_notes: [{ a_id: ids.a, b_id: ids.b, note: 'A sneaky note that should never land.' }] });
    assert.ok(save.error, 'anon cannot save');
    const { data, error } = await service.rpc('save_pair_notes', {
      p_notes: [{ a_id: ids.b, b_id: ids.a, note: 'Sweet rounds off the smoke so the spirit reads softer.' }],
    });
    assert.equal(error, null);
    assert.equal(data, 1);
  });

  test('anyone reads it, from either side, through a brand', async () => {
    const { data, error } = await anon.rpc('get_pair_note', { p_a: ids.brand, p_b: ids.b });
    assert.equal(error, null);
    assert.equal(data, 'Sweet rounds off the smoke so the spirit reads softer.');
  });

  test("an editor's note is never replaced by the writer", async () => {
    await db.query(`INSERT INTO public.ingredient_pair_notes (a_id, b_id, note, source) VALUES (LEAST($1::uuid, $2::uuid), GREATEST($1::uuid, $2::uuid), 'An editor wrote this one by hand, keep it.', 'editor')`, [
      ids.a,
      ids.c,
    ]);
    await service.rpc('save_pair_notes', { p_notes: [{ a_id: ids.a, b_id: ids.c, note: 'The writer would like to replace it with this.' }] });
    const { data } = await anon.rpc('get_pair_note', { p_a: ids.c, p_b: ids.a });
    assert.equal(data, 'An editor wrote this one by hand, keep it.');
  });
});
