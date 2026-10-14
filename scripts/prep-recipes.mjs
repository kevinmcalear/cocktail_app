// Turns supabase/seeds/preps/*.json into house prep recipe migrations: the
// amounts, yield, keep, steps and sources for shared catalog preps.
//
//   node scripts/prep-recipes.mjs                 write every seed file's migration
//   node scripts/prep-recipes.mjs --print <seed>  print one (prep-recipes.check.ts compares)
//
// One seed file is one migration (its "migration" key). The rules a seed
// must pass (sources, units, sugar and acid ranges, yields, keeps) are in
// prep-recipes.check.ts; this file only writes SQL.
//
// What a migration does, matched by name key, so a second run changes nothing:
//   * A plain ingredient a line needs ("Malic acid") is made, as a shared
//     generic, only when no shared ingredient has that name or alias.
//   * Each prep lands on the shared catalog prep of that name (or alias). A
//     shared bottle or style by that name is left alone; with no row at all,
//     a new shared prep is made under its style.
//   * Lines, steps, yield and keep are written only where the prep has none:
//     a prep whose only lines have no amounts (the technique fill's "with
//     what") gets the full recipe. `replace` (a corrected catalog recipe)
//     rewrites what the seed gives.
//   * Every fact keeps the page it came from in item_sources.
// Venue preps are never touched.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const DIR = 'supabase/seeds/preps';
export const CHECKED_ON_DEFAULT = '2026-10-14';

export function readSeeds(dir = DIR) {
  // No seeds yet is fine: git keeps no empty folder.
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({ file: join(dir, f), seed: JSON.parse(readFileSync(join(dir, f), 'utf8')) }));
}

function q(value) {
  if (value == null || value === '') return 'NULL';
  const text = String(value);
  if (!text.includes('$q$')) return `$q$${text}$q$`;
  return `'${text.replaceAll("'", "''")}'`;
}
const num = (v) => (v == null || v === '' ? 'NULL' : String(Number(v)));
const bool = (v) => (v ? 'true' : 'false');
const arr = (values) => (values?.length ? `ARRAY[${values.map(q).join(', ')}]::text[]` : "'{}'::text[]");
const date = (d) => `DATE '${d}'`;

function values(rows) {
  return rows.length ? rows.join(',\n') : null;
}

function insert(table, rows) {
  const v = values(rows);
  return v ? `INSERT INTO ${table} VALUES\n${v};\n` : '';
}

const comment = (lines) => lines.map((l) => (l ? `-- ${l}` : '--')).join('\n');

export function build(seed) {
  const preps = seed.preps ?? [];
  const stubs = (seed.ingredients ?? []).map(
    (s) => `(${q(s.name)}, ${q(s.description)}, ${q(s.kind_of ?? null)})`,
  );
  const prepRows = [];
  const aliasRows = [];
  const lineRows = [];
  const stepRows = [];
  const sourceRows = [];
  for (const p of preps) {
    const keeps = p.keeps ?? {};
    prepRows.push(
      `(${q(p.name)}, ${q(p.kind_of ?? null)}, ${bool(p.kind_of_force)}, ${q(p.description)}, ${num(p.abv)}, ${bool('abv' in p)}, ${num(p.yield?.amount)}, ${q(p.yield?.unit)}, ${num(keeps.hours)}, ${q(keeps.storage)}, ${arr(p.actions)}, ${bool(p.replace)})`,
    );
    for (const alias of p.aliases ?? []) aliasRows.push(`(${q(p.name)}, ${q(alias)})`);
    (p.recipe ?? []).forEach((l, i) => {
      lineRows.push(`(${q(p.name)}, ${i}, ${q(l.ingredient)}, ${num(l.amount)}, ${q(l.unit)}, ${q(l.note ?? null)}, ${bool(l.optional)})`);
    });
    (p.steps ?? []).forEach((s, i) => {
      stepRows.push(`(${q(p.name)}, ${i}, ${q(s.body)}, ${num(s.timer_seconds)})`);
    });
    for (const s of p.sources ?? []) {
      sourceRows.push(`(${q(p.name)}, ${q(s.field)}, ${q(s.url)}, ${q(s.kind)}, ${date(s.checked_on ?? seed.checked_on ?? CHECKED_ON_DEFAULT)}, ${q(s.note ?? null)})`);
    }
  }

  return `${comment(seed.header ?? [])}
--
-- Written by scripts/prep-recipes.mjs from ${seed.file ?? 'its seed file'};
-- edit the seed, not this file. Matched by name key: a second run changes
-- nothing, rows that are missing are made, and venue preps aren't touched.

SET statement_timeout = 0;
SET "app.image_worker" = 'on';
-- No paid flavour jobs: note the queue now and put it back at the end.
CREATE TEMP TABLE "flavor_jobs_before" AS SELECT * FROM "private"."item_flavor_jobs";

CREATE TEMP TABLE stub_in (name text PRIMARY KEY, description text, kind_of text);
CREATE TEMP TABLE prep_in (
    name text PRIMARY KEY, kind_of text, kind_of_force boolean NOT NULL, description text, abv numeric, has_abv boolean NOT NULL,
    yield_amount numeric, yield_unit text, keeps_hours integer, storage text, actions text[] NOT NULL, replace boolean NOT NULL
);
CREATE TEMP TABLE alias_in (name text NOT NULL, alias text NOT NULL);
CREATE TEMP TABLE line_in (name text NOT NULL, pos integer NOT NULL, ingredient text NOT NULL, amount numeric, unit text, note text, optional boolean NOT NULL, PRIMARY KEY (name, pos));
CREATE TEMP TABLE step_in (name text NOT NULL, pos integer NOT NULL, body text NOT NULL, timer_seconds integer, PRIMARY KEY (name, pos));
CREATE TEMP TABLE source_in (name text NOT NULL, field text NOT NULL, url text NOT NULL, kind text NOT NULL, checked_on date NOT NULL, note text);

${insert('stub_in', stubs)}
${insert('prep_in', prepRows)}
${insert('alias_in', aliasRows)}
${insert('line_in', lineRows)}
${insert('step_in', stepRows)}
${insert('source_in', sourceRows)}
-- A shared ingredient by name, else by alias.
CREATE FUNCTION pg_temp.shared(p_name text) RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT public.resolve_ingredient(p_name);
$$;
-- A style (or a prep standing in as one, "Falernum") by name.
CREATE FUNCTION pg_temp.style(p_name text) RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT COALESCE(
        (SELECT i.id FROM public.items i
          WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL AND i.ingredient_role IN ('generic', 'prep')
            AND public.ingredient_key(i.name) = public.ingredient_key(p_name)
          ORDER BY (i.ingredient_role = 'generic') DESC, i.is_core DESC, i.created_at LIMIT 1),
        (SELECT i.id FROM public.ingredient_aliases a JOIN public.items i ON i.id = a.item_id
          WHERE a.key = public.ingredient_key(p_name) AND i.bar_id IS NULL AND i.ingredient_role IN ('generic', 'prep')));
$$;
-- Changing a style trips guard_ingredient_name when another ingredient goes
-- by the prep's name; those keep the style they have.
CREATE FUNCTION pg_temp.name_free(p_id uuid, p_name text) RETURNS boolean LANGUAGE sql STABLE AS $$
    SELECT NOT EXISTS (SELECT 1 FROM public.ingredient_aliases a
                        WHERE a.key = public.ingredient_key(p_name) AND a.item_id <> p_id);
$$;

-- --- Plain ingredients the lines need ---
DO $$
DECLARE s record; v uuid;
BEGIN
    FOR s IN SELECT * FROM stub_in ORDER BY name LOOP
        IF pg_temp.shared(s.name) IS NULL THEN
            INSERT INTO public.items (name, item_type, ingredient_role, description, hide_from_search)
            VALUES (s.name, 'ingredient', 'generic', s.description, false) RETURNING id INTO v;
            -- A new name can pick up a core suffix as its kind; set it as meant.
            UPDATE public.items SET generic_id = pg_temp.style(s.kind_of)
             WHERE id = v AND generic_id IS DISTINCT FROM pg_temp.style(s.kind_of);
        END IF;
    END LOOP;
END $$;

-- --- The prep each recipe lands on ---
-- The shared catalog prep by that name or alias. A bottle or a style by the
-- name isn't a prep, and someone's own prep isn't the catalog's: skipped. A
-- correction may land on a style that already carries a recipe (Elderflower
-- cordial, which bottles file under).
CREATE TEMP TABLE prep_row AS
SELECT p.*, i.id, (i.id IS NULL) AS is_new
  FROM prep_in p
  LEFT JOIN public.items i ON i.id = pg_temp.shared(p.name);
DELETE FROM prep_row r USING public.items i
 WHERE i.id = r.id
   AND (i.bar_id IS NOT NULL OR i.created_by IS NOT NULL OR i.item_type <> 'ingredient'
        OR (COALESCE(i.ingredient_role, 'prep') <> 'prep'
            AND NOT (r.replace AND i.ingredient_role = 'generic'
                     AND EXISTS (SELECT 1 FROM public.recipes x WHERE x.recipe_item_id = i.id AND x.amount IS NOT NULL))));

WITH ins AS (
    INSERT INTO public.items (name, item_type, ingredient_role, description, abv, hide_from_search)
    SELECT r.name, 'ingredient', 'prep', r.description, r.abv, false
      FROM prep_row r WHERE r.id IS NULL
    RETURNING id, name
)
UPDATE prep_row r SET id = ins.id FROM ins WHERE r.id IS NULL AND r.name = ins.name;

-- The style: set where there's none (and on a new row), or where the seed
-- says the one it has is wrong.
UPDATE public.items i SET generic_id = pg_temp.style(r.kind_of)
  FROM prep_row r
 WHERE i.id = r.id AND r.kind_of IS NOT NULL AND pg_temp.style(r.kind_of) IS NOT NULL
   AND pg_temp.style(r.kind_of) <> i.id
   AND (i.generic_id IS NULL OR r.is_new OR (r.kind_of_force AND i.generic_id <> pg_temp.style(r.kind_of)))
   AND pg_temp.name_free(i.id, i.name);
UPDATE public.items i SET ingredient_role = 'prep'
  FROM prep_row r WHERE i.id = r.id AND i.ingredient_role IS NULL;

-- A description where there's none; a corrected recipe brings its own.
UPDATE public.items i SET description = r.description
  FROM prep_row r
 WHERE i.id = r.id AND r.description IS NOT NULL
   AND (NULLIF(btrim(i.description), '') IS NULL OR (r.replace AND i.description IS DISTINCT FROM r.description));

-- A corrected recipe brings its strength when a source gives one; an unknown
-- one only clears a 0 (orgeat with brandy in it isn't 0%).
UPDATE public.items i SET abv = r.abv
  FROM prep_row r
 WHERE i.id = r.id AND r.replace AND r.has_abv AND i.abv IS DISTINCT FROM r.abv
   AND (r.abv IS NOT NULL OR i.abv = 0);

-- Other names people write it under, when nobody else has them.
INSERT INTO public.ingredient_aliases (key, item_id)
SELECT DISTINCT ON (public.ingredient_key(a.alias)) public.ingredient_key(a.alias), r.id
  FROM alias_in a JOIN prep_row r ON r.name = a.name
 WHERE public.ingredient_key(a.alias) IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.items i WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL
                      AND public.ingredient_key(i.name) = public.ingredient_key(a.alias))
ON CONFLICT (key) DO NOTHING;

-- --- Lines ---
-- Which preps get these lines: no line with an amount yet, or a correction.
CREATE TEMP TABLE prep_lines AS
SELECT r.id, r.name FROM prep_row r
 WHERE EXISTS (SELECT 1 FROM line_in l WHERE l.name = r.name)
   AND (r.replace OR NOT EXISTS (SELECT 1 FROM public.recipes x WHERE x.recipe_item_id = r.id AND x.amount IS NOT NULL));

DO $$
DECLARE missing text;
BEGIN
    SELECT string_agg(DISTINCT l.name || ': ' || l.ingredient, ', ') INTO missing
      FROM line_in l JOIN prep_lines p ON p.name = l.name
     WHERE pg_temp.shared(l.ingredient) IS NULL OR pg_temp.shared(l.ingredient) = p.id;
    IF missing IS NOT NULL THEN
        RAISE EXCEPTION 'Recipe lines with no shared ingredient: %', missing;
    END IF;
END $$;

DELETE FROM public.recipes x USING prep_lines p WHERE x.recipe_item_id = p.id;
INSERT INTO public.recipes (recipe_item_id, ingredient_item_id, amount, unit, preparation_notes, is_optional, sort_order)
SELECT p.id, pg_temp.shared(l.ingredient), l.amount, l.unit, l.note, l.optional, l.pos
  FROM line_in l JOIN prep_lines p ON p.name = l.name;

-- The strength trigger reads a batch as one serve. These are prep recipes:
-- clear that, and keep the ABV written by hand.
UPDATE public.items i SET serve_ml = NULL, serve_abv = NULL
  FROM prep_lines p
 WHERE i.id = p.id AND i.abv_source = 'manual' AND (i.serve_ml IS NOT NULL OR i.serve_abv IS NOT NULL);

-- --- Yield, keep, storage and how it's made ---
INSERT INTO public.item_prep AS ip (item_id, yield_amount, yield_unit, shelf_life_hours, storage, actions)
SELECT r.id, r.yield_amount, r.yield_unit, r.keeps_hours, r.storage, r.actions FROM prep_row r
ON CONFLICT (item_id) DO UPDATE SET
    -- A corrected recipe's yield is its own, even none: the old one was for other amounts.
    yield_amount = CASE WHEN (SELECT r.replace FROM prep_row r WHERE r.id = ip.item_id) THEN EXCLUDED.yield_amount
                        WHEN ip.yield_amount IS NULL THEN EXCLUDED.yield_amount ELSE ip.yield_amount END,
    yield_unit = CASE WHEN (SELECT r.replace FROM prep_row r WHERE r.id = ip.item_id) THEN EXCLUDED.yield_unit
                      WHEN ip.yield_amount IS NULL THEN EXCLUDED.yield_unit ELSE ip.yield_unit END,
    shelf_life_hours = CASE WHEN (SELECT r.replace FROM prep_row r WHERE r.id = ip.item_id) THEN EXCLUDED.shelf_life_hours
                            ELSE COALESCE(ip.shelf_life_hours, EXCLUDED.shelf_life_hours) END,
    storage = CASE WHEN EXCLUDED.storage IS NOT NULL AND (NULLIF(btrim(ip.storage), '') IS NULL OR (SELECT r.replace FROM prep_row r WHERE r.id = ip.item_id))
                   THEN EXCLUDED.storage ELSE ip.storage END,
    actions = ip.actions || ARRAY(SELECT u.t FROM unnest(EXCLUDED.actions) WITH ORDINALITY u(t, n)
                                   WHERE u.t <> ALL (ip.actions) ORDER BY u.n),
    updated_at = now();

-- --- Steps ---
CREATE TEMP TABLE prep_steps AS
SELECT r.id, r.name FROM prep_row r
 WHERE EXISTS (SELECT 1 FROM step_in s WHERE s.name = r.name)
   AND (r.replace OR NOT EXISTS (SELECT 1 FROM public.item_steps x WHERE x.item_id = r.id));
DELETE FROM public.item_steps x USING prep_steps p WHERE x.item_id = p.id;
INSERT INTO public.item_steps (item_id, position, body, timer_seconds)
SELECT p.id, s.pos, s.body, s.timer_seconds FROM step_in s JOIN prep_steps p ON p.name = s.name;

-- --- Where each fact comes from ---
-- A corrected recipe's old sources for the facts it rewrites go first.
DELETE FROM public.item_sources s USING prep_row r
 WHERE r.replace AND s.item_id = r.id AND s.field IN ('recipe', 'yield', 'keeps')
   AND NOT EXISTS (SELECT 1 FROM source_in n WHERE n.name = r.name AND n.field = s.field AND n.url = s.url);
INSERT INTO public.item_sources (item_id, field, url, kind, checked_on, note)
SELECT r.id, s.field, s.url, s.kind, s.checked_on, s.note
  FROM source_in s JOIN prep_row r ON r.name = s.name
ON CONFLICT ON CONSTRAINT "item_sources_one_per_page" DO UPDATE
   SET note = EXCLUDED.note, kind = EXCLUDED.kind, checked_on = EXCLUDED.checked_on
 WHERE item_sources.note IS DISTINCT FROM EXCLUDED.note OR item_sources.kind IS DISTINCT FROM EXCLUDED.kind;

-- --- Put the flavour job queue back ---
DELETE FROM "private"."item_flavor_jobs" j
WHERE NOT EXISTS (SELECT 1 FROM "flavor_jobs_before" o WHERE o.item_id = j.item_id);
UPDATE "private"."item_flavor_jobs" j SET
    "status" = o.status, "revision" = o.revision, "attempts" = o.attempts, "run_after" = o.run_after,
    "lease_until" = o.lease_until, "last_error" = o.last_error, "updated_at" = o.updated_at
FROM "flavor_jobs_before" o
WHERE j.item_id = o.item_id AND j.revision <> o.revision;

DROP TABLE "flavor_jobs_before", "stub_in", "prep_in", "alias_in", "line_in", "step_in", "source_in",
           "prep_row", "prep_lines", "prep_steps";
DROP FUNCTION pg_temp.shared(text);
DROP FUNCTION pg_temp.style(text);
DROP FUNCTION pg_temp.name_free(uuid, text);
RESET "app.image_worker";
`;
}

export function output(file, seed) {
  return build({ ...seed, file: file.replaceAll('\\', '/') });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const at = process.argv.indexOf('--print');
  if (at >= 0) {
    const file = process.argv[at + 1];
    process.stdout.write(output(file, JSON.parse(readFileSync(file, 'utf8'))));
  } else {
    for (const { file, seed } of readSeeds()) {
      const out = join('supabase/migrations', seed.migration);
      writeFileSync(out, output(file, seed));
      process.stdout.write(`${out}\n`);
    }
  }
}
