// Shot and Cordial glass types (20261126100000_shot_and_cordial_glasses.sql):
// the two are glass types everywhere a type is checked, the catalog's shot and
// cordial glasses moved to them by their own data, and a drink in either is
// drawn in it.
// Runs against the local stack only: `npm run test:security`.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import pg from 'pg';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run shot and cordial glass tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const db = new pg.Client({ connectionString: status.DB_URL });
const ids = [];

const inputs = (glass) => ({
  v: 1, glass, ice: 'cubes', method: 'stir', liquid: { hex: '#aa3322', alpha: 0.8 }, foam: null, float: null, bleed: null,
  fizz: false, garnish: null, coverage: 0.6, from: { glass: 'rules', ice: 'rules', method: 'rules', liquid: 'rules', garnish: 'default' },
});
const one = async (sql, args = []) => (await db.query(sql, args)).rows[0];

before(async () => {
  await db.connect();
});

after(async () => {
  await db.query('DELETE FROM public.items WHERE id = ANY($1)', [ids]);
  await db.end();
});

describe('shot and cordial glasses', () => {
  test('both are glass types, and nothing else new is', async () => {
    const r = await one("SELECT private.is_glass_type('shot') AS shot, private.is_glass_type('cordial') AS cordial, private.is_glass_type('pony') AS pony");
    assert.deepEqual(r, { shot: true, cordial: true, pony: false });
    assert.equal((await one("SELECT private.valid_sketch_inputs($1) AS ok", [JSON.stringify(inputs('cordial'))])).ok, true);
  });

  test('the catalog has a shape for each, of its own type', async () => {
    const { rows } = await db.query(
      "SELECT name, glass FROM public.items WHERE item_type = 'glassware' AND bar_id IS NULL AND lower(name) IN ('shot', 'cordial') ORDER BY name"
    );
    assert.deepEqual(rows, [{ name: 'Cordial', glass: 'cordial' }, { name: 'Shot', glass: 'shot' }]);
  });

  test('the catalog\'s shot and cordial glasses are filed under them', async () => {
    const r = await one(`
      SELECT count(*) FILTER (WHERE glass = 'shot')::int AS shot,
             count(*) FILTER (WHERE glass = 'cordial')::int AS cordial,
             count(*) FILTER (WHERE glass NOT IN ('shot', 'mug') AND name ~* '\\mshots?\\M|shooter')::int AS shot_elsewhere,
             count(*) FILTER (WHERE glass NOT IN ('shot', 'cordial') AND name ~* 'cordial|liqueur|pousse')::int AS cordial_elsewhere,
             count(*) FILTER (WHERE variant = 'rocks_shot' AND name !~* 'rocks|old fashioned')::int AS rocks_drawn_shot,
             count(*) FILTER (WHERE glass IN ('shot', 'cordial') AND variant IS NOT NULL)::int AS with_variant
        FROM public.glass_models`);
    assert.ok(r.shot >= 90, `shot glasses: ${r.shot}`);
    assert.ok(r.cordial >= 15, `cordials: ${r.cordial}`);
    assert.deepEqual([r.shot_elsewhere, r.cordial_elsewhere, r.rocks_drawn_shot, r.with_variant], [0, 0, 0, 0]);
    const wrong = await one(`
      SELECT count(*)::int AS n FROM public.glass_models m JOIN public.items s ON s.id = m.shape_item_id
       WHERE m.glass IN ('shot', 'cordial') AND s.glass IS DISTINCT FROM m.glass`);
    assert.equal(wrong.n, 0, 'every one is a kind of its type\'s shape');
  });

  test('a drink in a shot or a cordial glass is drawn in it', async () => {
    for (const glass of ['shot', 'cordial']) {
      const g = await one("INSERT INTO public.items (name, item_type, glass) VALUES ($1, 'glassware', $2) RETURNING id", [`${glass} glass ${run}`, glass]);
      const d = await one("INSERT INTO public.items (name, item_type, glassware_id) VALUES ($1, 'cocktail', $2) RETURNING id", [`${glass} drink ${run}`, g.id]);
      ids.push(d.id, g.id);
      await db.query(
        "INSERT INTO public.item_sketches (item_id, inputs, source, spec_fingerprint, rules_version) VALUES ($1, $2, 'rules', 'f', 1)",
        [d.id, JSON.stringify(inputs('rocks'))]
      );
      const s = (await one('SELECT inputs FROM public.item_sketches WHERE item_id = $1', [d.id])).inputs;
      assert.deepEqual([s.glass, s.from.glass], [glass, 'data']);
    }
  });

  test('a drink in a catalog shot glass takes its shape and its outline', async () => {
    const m = await one("SELECT id, shape_item_id FROM public.glass_models WHERE glass = 'shot' AND outline IS NOT NULL ORDER BY name LIMIT 1");
    const d = await one("INSERT INTO public.items (name, item_type, glass_model_id) VALUES ($1, 'cocktail', $2) RETURNING id, glassware_id", [`model drink ${run}`, m.id]);
    ids.push(d.id);
    assert.equal(d.glassware_id, m.shape_item_id);
    await db.query(
      "INSERT INTO public.item_sketches (item_id, inputs, source, spec_fingerprint, rules_version) VALUES ($1, $2, 'rules', 'f', 1)",
      [d.id, JSON.stringify(inputs('rocks'))]
    );
    const s = (await one('SELECT inputs FROM public.item_sketches WHERE item_id = $1', [d.id])).inputs;
    assert.equal(s.glass, 'shot');
    assert.ok(s.outline, 'drawn in its traced outline');
    assert.equal(s.variant, undefined);
  });
});
