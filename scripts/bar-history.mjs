// Turns scripts/data/bar-history/*.json (researched glassware and menu
// history per bar) into a migration that extends profile_menu_editions, the
// drinks on them and the bars' glassware. One source of truth: the check
// script fails if the SQL file drifts.
//
//   node scripts/bar-history.mjs            write the migration
//   node scripts/bar-history.mjs --print    print it instead
//   node scripts/bar-history.mjs --report   coverage table (markdown)
//
// Each file is { batch, researched_on, searches_used, bars: [...] }, a bar:
//   handle                    profiles.handle of the bar
//   glassware[]               { maker, designer, series, shapes[{ name,
//                             sketch_shape, shape_note }], source_urls }
//   drink_glasses[]           { drink, glass, sketch_shape, shape_note, source_url }
//   editions[]                { name, existing { name, start } | null, start,
//                             end ('YYYY-MM' | 'YYYY' | null), end_basis,
//                             is_current, drinks[{ name, ingredients[] }],
//                             remove_drinks?, source_urls }
//   sightings[]               { drink, ingredients[], seen, source_url }
//   rename_drinks?            [{ from, to }] for names an earlier seed got wrong
//   coverage                  { glassware, current_menu, history, searches, notes }
// Names, ingredients, dates and sources only, never menu prose.
//
// Needs 20261007153000_menu_edition_dates (end dates, is_current,
// menu_name_key). ponytail: bar glassware is written only when
// public.bar_glassware and items.sketch_variant exist
// (20261007100000_glass_variants, keyed on the bar's profile), so this
// applies before that lands.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const DIR = 'scripts/data/bar-history';
const GENERICS = 'supabase/migrations/20260930960000_ingredient_generics.sql';
const OUT = 'supabase/migrations/20261007190000_bar_history.sql';
const SHAPES = new Set([
  'coupe', 'nick', 'martini', 'rocks', 'highball', 'collins', 'fizz', 'flute', 'wine', 'spritz',
  'snifter', 'beer', 'julep', 'tiki', 'mug', 'ceramic',
]);
// The shared glassware items a sketch shape draws as (items.glassware_id).
const GLASSWARE_ITEM = { nick: 'Nick & Nora', martini: 'Martini', wine: 'Wine', julep: 'Julep Cup' };
const BASE_VARIANTS = new Set(['martini_classic', 'coupe_wide', 'nick_bell', 'rocks_straight', 'highball_straight']);
const COVERAGE = new Set(['found', 'partial', 'none_found', 'not_searched']);
const DATE = /^(\d{4})(?:-(0?[1-9]|1[0-2]))?$/;
const URL = /^https?:\/\/\S+$/;

function fail(where, message) {
  throw new Error(`${where}: ${message}`);
}

// "2024-05" -> { year: 2024, month: 5 }, "2024" -> { year: 2024, month: null }.
export function parseDate(value, where) {
  if (value == null) return { year: null, month: null };
  const m = DATE.exec(value);
  if (!m) fail(where, `bad date ${JSON.stringify(value)}`);
  return { year: Number(m[1]), month: m[2] ? Number(m[2]) : null };
}

function clean(text) {
  return typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : text;
}

// The generics backfill's known bottles: lowercase name -> { generic, category }.
// A new ingredient named like one takes the same generic and category here,
// so re-running that backfill stays a no-op.
export function knownIngredients(file = GENERICS) {
  const list = readFileSync(file, 'utf8').split('INSERT INTO "known_ingredients" VALUES')[1].split(';\n')[0];
  const str = "'((?:[^']|'')*)'";
  const known = new Map();
  for (const m of list.matchAll(new RegExp(`\\(${str}, (?:${str}|NULL), (?:${str}|NULL)\\)`, 'g'))) {
    const un = (v) => (v == null ? null : v.replaceAll("''", "'"));
    // A bottle can be listed twice, once for its generic and once for its category.
    const key = un(m[1]).toLowerCase();
    const prev = known.get(key);
    known.set(key, { generic: prev?.generic ?? un(m[2]), category: prev?.category ?? un(m[3]) });
  }
  return known;
}

// How a menu name matches a bar's drink: public.menu_name_key
// (20261007153000), so drinks that would collide there are one drink here.
export function nameKey(name) {
  const plain = name.toLowerCase().trim();
  const key = plain.replace(/^the\s+/, '')
    .replace(/[\x01-\x2f\x3a-\x40\x5b-\x60\x7b-\x7f\u00a0-\u00bf\u2000-\u206f\u3000-\u303f\uff01-\uff0f]+/g, '');
  return key || plain;
}

// New shared ingredients follow the catalog's Title Case ("Oolong Tea").
export function titleCase(name) {
  return name.replace(/(^|[\s(/-])(\p{Ll})/gu, (_, pre, ch) => pre + ch.toLocaleUpperCase('en'));
}

// The drawing a researched shape note matches, a key of lib/sketch
// GLASS_VARIANTS ('rocks_heavy'), or null when the note doesn't say.
export function pickVariant(glass, note) {
  const t = (note || '').toLowerCase();
  if (!t) return null;
  const has = (re) => re.test(t);
  switch (glass) {
    case 'martini':
      if (has(/\bpony\b|\blittle\b|short stem/)) return 'martini_pony';
      if (has(/\bsoft\b|rounded|curved/)) return 'martini_soft';
      if (has(/\bv[- ]shaped\b|\bcone\b|conical/)) return 'martini_classic';
      return null;
    case 'coupe':
      if (has(/saucer|shallow/)) return 'coupe_saucer';
      if (has(/\bdeep\b/)) return 'coupe_deep';
      if (has(/\bwide\b/)) return 'coupe_wide';
      return null;
    case 'nick':
      if (has(/tulip/)) return 'nick_tulip';
      // Every Nick & Nora is small; only a note that says little or mini.
      if (has(/\blittle\b|\bmini/)) return 'nick_little';
      if (has(/\bbell\b/)) return 'nick_bell';
      return null;
    case 'rocks':
    case 'highball':
      if (has(/heavy|thick base|weighted/)) return `${glass}_heavy`;
      if (has(/taper|flar/)) return `${glass}_tapered`;
      if (has(/straight/)) return `${glass}_straight`;
      return null;
    default:
      return null;
  }
}

// One row per researched shape for bar_glassware. The default of each glass
// type is the shape most of the bar's drinks are served in (first listed on
// a tie), and a drink gets its own variant only when it differs from that.
export function glasswareFor(bar) {
  const rows = [];
  for (const g of bar.glassware || []) {
    for (const s of g.shapes || []) {
      if (!s.sketch_shape) continue;
      rows.push({
        glass: s.sketch_shape, variant: pickVariant(s.sketch_shape, s.shape_note), name: clean(s.name),
        maker: clean(g.maker), designer: clean(g.designer), series: clean(g.series), shape_note: clean(s.shape_note),
        source_urls: g.source_urls || [], uses: 0, is_default: false,
      });
    }
  }
  const drinks = [];
  for (const d of bar.drink_glasses || []) {
    if (!d.sketch_shape) continue;
    const shape = rows.find((r) => r.glass === d.sketch_shape && r.name?.toLowerCase() === clean(d.glass)?.toLowerCase());
    if (shape) shape.uses += 1;
    drinks.push({ drink: clean(d.drink), glass: d.sketch_shape, variant: pickVariant(d.sketch_shape, d.shape_note) ?? shape?.variant ?? null });
  }
  for (const glass of new Set(rows.map((r) => r.glass))) {
    const ofType = rows.filter((r) => r.glass === glass);
    ofType.reduce((best, r) => (r.uses > best.uses ? r : best), ofType[0]).is_default = true;
  }
  // The first variant of each glass is its default drawing, the same as null.
  const drawn = (glass, variant) => (variant == null || BASE_VARIANTS.has(variant) ? null : variant);
  const defaults = new Map(rows.filter((r) => r.is_default).map((r) => [r.glass, drawn(r.glass, r.variant)]));
  const variants = drinks.filter((d) => d.variant && drawn(d.glass, d.variant) !== (defaults.get(d.glass) ?? null));
  return { rows, variants };
}

function checkStrings(value, where) {
  if (typeof value === 'string') {
    if (/[–—]/.test(value)) fail(where, `dash in ${JSON.stringify(value)}`);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => checkStrings(v, `${where}[${i}]`));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) checkStrings(v, `${where}.${k}`);
  }
}

export function load(dir = DIR) {
  const bars = new Map();
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const data = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    checkStrings(data, file);
    for (const bar of data.bars || []) {
      const where = `${file} ${bar.handle}`;
      if (!bar.handle || typeof bar.handle !== 'string') fail(file, 'bar without handle');
      if (bars.has(bar.handle)) fail(where, 'bar listed twice');
      const cov = bar.coverage || {};
      for (const k of ['glassware', 'current_menu', 'history']) {
        if (!COVERAGE.has(cov[k])) fail(where, `coverage.${k} is ${JSON.stringify(cov[k])}`);
      }
      for (const g of bar.glassware || []) {
        for (const s of g.shapes || []) {
          if (s.sketch_shape != null && !SHAPES.has(s.sketch_shape)) fail(where, `sketch_shape ${s.sketch_shape}`);
        }
        for (const u of g.source_urls || []) if (!URL.test(u)) fail(where, `url ${u}`);
      }
      for (const g of bar.drink_glasses || []) {
        if (g.sketch_shape != null && !SHAPES.has(g.sketch_shape)) fail(where, `sketch_shape ${g.sketch_shape}`);
        if (g.source_url != null && !URL.test(g.source_url)) fail(where, `url ${g.source_url}`);
      }
      for (const e of bar.editions || []) {
        const ew = `${where} "${e.name}"`;
        if (!clean(e.name) || clean(e.name).length > 120) fail(ew, 'edition name');
        e.startDate = parseDate(e.start, ew);
        e.endDate = parseDate(e.end, ew);
        if (e.existing) e.existingDate = parseDate(e.existing.start, ew);
        for (const u of e.source_urls || []) if (!URL.test(u)) fail(ew, `url ${u}`);
        for (const d of e.drinks || []) if (!clean(d.name)) fail(ew, 'drink without name');
      }
      for (const s of bar.sightings || []) {
        if (!clean(s.drink)) fail(where, 'sighting without drink');
        if (s.source_url != null && !URL.test(s.source_url)) fail(where, `url ${s.source_url}`);
      }
      bars.set(bar.handle, { ...bar, file });
    }
  }
  return [...bars.values()].sort((a, b) => a.handle.localeCompare(b.handle));
}

export function q(value) {
  if (value == null || value === '') return 'NULL';
  const text = String(value);
  if (!text.includes('$q$')) return `$q$${text}$q$`;
  return `'${text.replaceAll("'", "''")}'`;
}

const n = (v) => (v == null ? 'NULL' : String(v));
const b = (v) => (v == null ? 'NULL' : v ? 'true' : 'false');
const textArray = (vs) => (vs.length ? `ARRAY[${vs.map(q).join(', ')}]::text[]` : "'{}'::text[]");

function values(table, rows) {
  if (!rows.length) return '';
  return `INSERT INTO "${table}" VALUES\n    ${rows.map((r) => `(${r.join(', ')})`).join(',\n    ')};\n`;
}

export function build(bars) {
  const editions = [];
  const drinks = new Map();
  const lines = [];
  const menu = [];
  const renames = [];
  const removes = [];
  const glassware = [];
  const drinkVariants = [];

  const addDrink = (handle, name, ingredients, note, year, glass) => {
    const key = `${handle}\0${nameKey(name)}`;
    const prev = drinks.get(key);
    if (!prev) {
      drinks.set(key, { handle, name, ingredients: ingredients || [], note, year, glass: glass || null });
      return;
    }
    if (!prev.ingredients.length && ingredients?.length) {
      prev.ingredients = ingredients;
      prev.note = note;
    }
    if (year != null && (prev.year == null || year < prev.year)) prev.year = year;
    prev.glass ||= glass || null;
  };

  for (const bar of bars) {
    const glassOf = new Map((bar.drink_glasses || []).map((g) => [
      clean(g.drink).toLocaleLowerCase('en'), GLASSWARE_ITEM[g.sketch_shape] || clean(g.glass),
    ]));
    for (const r of bar.rename_drinks || []) renames.push([q(bar.handle), q(clean(r.from)), q(clean(r.to))]);
    const { rows, variants } = glasswareFor(bar);
    rows.forEach((r, i) => glassware.push([
      q(bar.handle), q(r.glass), q(r.variant), q(r.name), q(r.maker), q(r.designer), q(r.series), q(r.shape_note),
      textArray(r.source_urls.slice(0, 10)), b(r.is_default), n(i),
    ]));
    for (const v of variants) drinkVariants.push([q(bar.handle), q(v.drink), q(v.variant)]);
    for (const e of bar.editions || []) {
      if (e.startDate.year == null) continue;
      const name = clean(e.name);
      const url = (e.source_urls || [])[0] || null;
      editions.push([
        q(bar.handle), q(name), n(e.startDate.year), n(e.startDate.month),
        n(e.endDate.year), n(e.endDate.month), b(e.is_current), q(url),
        q(e.existing ? clean(e.existing.name) : null), n(e.existingDate?.year), n(e.existingDate?.month),
      ]);
      for (const r of e.remove_drinks || []) {
        removes.push([q(bar.handle), q(name), n(e.startDate.year), n(e.startDate.month), q(clean(r))]);
      }
      (e.drinks || []).forEach((d, i) => {
        const dn = clean(d.name);
        const ingredients = (d.ingredients || []).map(clean).filter(Boolean);
        const note = ingredients.length && url
          ? `Listed ingredients from ${url}. No measures have been published.`
          : url ? `Named on the ${name} list (${url}).` : null;
        addDrink(bar.handle, dn, ingredients, note, e.startDate.year, glassOf.get(dn.toLocaleLowerCase('en')));
        menu.push([q(bar.handle), q(name), n(e.startDate.year), n(e.startDate.month), n(i), q(dn)]);
      });
    }
    // A drink seen on an undated list is the bar's drink with no menu, so it
    // stays searchable and rankable. Only with the source that names it.
    for (const s of bar.sightings || []) {
      if (!s.source_url) continue;
      const dn = clean(s.drink);
      const ingredients = (s.ingredients || []).map(clean).filter(Boolean);
      const seen = parseDate(s.seen, `${bar.handle} sighting`);
      const note = `${ingredients.length ? 'Listed ingredients from' : 'Named in'} ${s.source_url}${s.seen ? ` (seen ${s.seen})` : ''}. No measures have been published.`;
      addDrink(bar.handle, dn, ingredients, note, seen.year, glassOf.get(dn.toLocaleLowerCase('en')));
    }
  }

  const drinkRows = [...drinks.values()].map((d) => [q(d.handle), q(d.name), q(d.note), n(d.year), q(d.glass)]);
  const known = knownIngredients();
  for (const d of drinks.values()) {
    d.ingredients.forEach((ing, i) => {
      const k = known.get(ing.toLowerCase());
      lines.push([q(d.handle), q(d.name), n(i), q(ing), q(titleCase(ing)), q(k?.generic), q(k?.category)]);
    });
  }

  return `-- DRAFT. Local stack only until Kevin's OK.
-- Generated by scripts/bar-history.mjs from scripts/data/bar-history/*.json.
-- Menu editions, the drinks on them and their listed ingredients, researched
-- from bars' own sites and press. Extends what 20260930900100,
-- 20260930900200 and 20261002200000 seeded: an edition that names an
-- existing one corrects its name or date, new ones insert once, a drink the
-- bar already has keeps its row and only gains empty fields, ingredient
-- lines land only on a drink with none, and a drink goes on a menu once.
-- Bars missing from the database (local, tests) are skipped.

-- Seeded drinks don't queue automatic sketches (nobody to bill for them).
SET "app.image_worker" = 'on';


CREATE TEMP TABLE "bh_editions" ("handle" text, "name" text, "year" int, "month" int, "end_year" int, "end_month" int,
    "is_current" boolean, "source_url" text, "old_name" text, "old_year" int, "old_month" int);
CREATE TEMP TABLE "bh_drinks" ("handle" text, "name" text, "notes" text, "origin_year" int, "glass" text);
CREATE TEMP TABLE "bh_lines" ("handle" text, "drink" text, "pos" int, "ingredient" text, "new_name" text,
    "generic" text, "category" text);
CREATE TEMP TABLE "bh_menu" ("handle" text, "edition" text, "year" int, "month" int, "pos" int, "drink" text);
CREATE TEMP TABLE "bh_renames" ("handle" text, "from_name" text, "to_name" text);
CREATE TEMP TABLE "bh_removes" ("handle" text, "edition" text, "year" int, "month" int, "drink" text);
CREATE TEMP TABLE "bh_glassware" ("handle" text, "glass" text, "variant" text, "name" text, "maker" text, "designer" text,
    "series" text, "shape_note" text, "source_urls" text[], "is_default" boolean, "sort_order" int);
CREATE TEMP TABLE "bh_variants" ("handle" text, "drink" text, "variant" text);

${values('bh_editions', editions)}
${values('bh_drinks', drinkRows)}
${values('bh_lines', lines)}
${values('bh_menu', menu)}
${values('bh_renames', renames)}
${values('bh_removes', removes)}
${values('bh_glassware', glassware)}
${values('bh_variants', drinkVariants)}
CREATE TEMP TABLE "bh_bars" AS
SELECT DISTINCT ON (p.handle) p.handle, p.id FROM "public"."profiles" p
WHERE p.kind = 'bar' AND p.handle IN (
    SELECT handle FROM "bh_editions" UNION SELECT handle FROM "bh_drinks"
    UNION SELECT handle FROM "bh_renames" UNION SELECT handle FROM "bh_glassware"
)
ORDER BY p.handle, p.created_at;

-- Nor flavour jobs, which ignore app.image_worker: with CATALOG_AI_FILL=on
-- each one is a paid AI fill and drawing for a drink with no venue. Note
-- these bars' drinks' jobs now; at the end the drinks this touched go back
-- to them, and the rest of the queue is never touched. The backfill for
-- these drinks runs separately, once it's OK'd.
CREATE TEMP TABLE "bh_flavor_jobs" AS
SELECT j.* FROM "private"."item_flavor_jobs" j
JOIN "public"."items" i ON i.id = j.item_id
WHERE i.item_type = 'cocktail' AND i.bar_id IS NULL AND i.origin_bar_profile_id IN (SELECT id FROM "bh_bars");

-- --- Editions ---

-- Corrections: the named existing edition takes the researched name and date,
-- unless another row already has them.
UPDATE "public"."profile_menu_editions" e SET
    "name" = x.name, "year" = x.year, "month" = x.month,
    "source_url" = coalesce(e.source_url, x.source_url)
FROM "bh_editions" x
JOIN "bh_bars" p ON p.handle = x.handle
WHERE x.old_name IS NOT NULL
  AND e.profile_id = p.id AND e.name = x.old_name AND e.year = x.old_year AND e.month IS NOT DISTINCT FROM x.old_month
  AND NOT EXISTS (
      SELECT 1 FROM "public"."profile_menu_editions" o
      WHERE o.profile_id = p.id AND o.id <> e.id AND o.name = x.name AND o.year = x.year AND o.month IS NOT DISTINCT FROM x.month
  );

INSERT INTO "public"."profile_menu_editions" ("profile_id", "name", "year", "month", "source_url")
SELECT p.id, x.name, x.year, x.month, x.source_url
FROM "bh_editions" x
JOIN "bh_bars" p ON p.handle = x.handle
ON CONFLICT ON CONSTRAINT "profile_menu_editions_once" DO NOTHING;

UPDATE "public"."profile_menu_editions" e SET "source_url" = x.source_url
FROM "bh_editions" x
JOIN "bh_bars" p ON p.handle = x.handle
WHERE e.profile_id = p.id AND e.name = x.name AND e.year = x.year AND e.month IS NOT DISTINCT FROM x.month
  AND e.source_url IS NULL AND x.source_url IS NOT NULL;

-- End dates and the current menu (20261007153000). Research wins over the
-- dates that migration inferred: a researched end overwrites, a current menu
-- has no end, and a menu known to be off keeps the inferred end when
-- research has none.
UPDATE "public"."profile_menu_editions" e SET
    "end_year" = CASE WHEN x.is_current THEN NULL WHEN x.end_year IS NOT NULL THEN x.end_year::smallint ELSE e.end_year END,
    "end_month" = CASE WHEN x.is_current THEN NULL WHEN x.end_year IS NOT NULL THEN x.end_month::smallint ELSE e.end_month END,
    "is_current" = CASE WHEN x.is_current IS NOT NULL THEN x.is_current WHEN x.end_year IS NOT NULL THEN false ELSE e.is_current END
FROM "bh_editions" x
JOIN "bh_bars" p ON p.handle = x.handle
WHERE e.profile_id = p.id AND e.name = x.name AND e.year = x.year AND e.month IS NOT DISTINCT FROM x.month
  AND (x.is_current IS NOT NULL OR x.end_year IS NOT NULL);

-- Menus this adds change what came next for their neighbours: re-run
-- 20261007153000's rule (a menu ran until the bar's next one started) on
-- these bars, except where research gave the end or found the menu on now.
UPDATE "public"."profile_menu_editions" e
SET "end_year" = n.year, "end_month" = n.month, "is_current" = false
FROM (
    SELECT DISTINCT ON (a.id) a.id, b.year, b.month
    FROM "public"."profile_menu_editions" a
    JOIN "public"."profile_menu_editions" b
      ON b.profile_id = a.profile_id
     AND (b.year > a.year OR (b.year = a.year AND a.month IS NOT NULL AND b.month > a.month))
    WHERE a.profile_id IN (SELECT id FROM "bh_bars")
    ORDER BY a.id, b.year, b.month NULLS FIRST
) n
WHERE e.id = n.id
  AND NOT EXISTS (
      SELECT 1 FROM "bh_editions" x JOIN "bh_bars" p ON p.handle = x.handle
      WHERE p.id = e.profile_id AND x.name = e.name AND x.year = e.year AND x.month IS NOT DISTINCT FROM e.month
        AND (x.end_year IS NOT NULL OR x.is_current)
  );

-- --- Drinks: the bar's shared cocktails, new where it has none of that name ---

-- A drink the earlier seeds misnamed takes its menu's spelling, unless the
-- bar already has a drink by that name.
UPDATE "public"."items" i SET "name" = r.to_name
FROM "bh_renames" r
JOIN "bh_bars" p ON p.handle = r.handle
WHERE i.item_type = 'cocktail' AND i.bar_id IS NULL AND i.origin_bar_profile_id = p.id
  AND public.menu_name_key(i.name) = public.menu_name_key(r.from_name)
  AND NOT EXISTS (
      SELECT 1 FROM "public"."items" o
      WHERE o.item_type = 'cocktail' AND o.bar_id IS NULL AND o.origin_bar_profile_id = p.id AND public.menu_name_key(o.name) = public.menu_name_key(r.to_name)
  );

-- Where the bar has both spellings, its menus list the right one.
UPDATE "public"."profile_menu_edition_drinks" x SET "item_id" = t.id
FROM "bh_renames" r
JOIN "bh_bars" p ON p.handle = r.handle
JOIN "public"."items" f ON f.item_type = 'cocktail' AND f.bar_id IS NULL AND f.origin_bar_profile_id = p.id
    AND public.menu_name_key(f.name) = public.menu_name_key(r.from_name)
JOIN "public"."items" t ON t.item_type = 'cocktail' AND t.bar_id IS NULL AND t.origin_bar_profile_id = p.id
    AND public.menu_name_key(t.name) = public.menu_name_key(r.to_name)
WHERE x.item_id = f.id AND f.id <> t.id
  AND NOT EXISTS (SELECT 1 FROM "public"."profile_menu_edition_drinks" o WHERE o.edition_id = x.edition_id AND o.item_id = t.id);
DELETE FROM "public"."profile_menu_edition_drinks" x
USING "bh_renames" r, "bh_bars" p, "public"."items" f
WHERE p.handle = r.handle AND f.origin_bar_profile_id = p.id AND f.item_type = 'cocktail' AND f.bar_id IS NULL
  AND public.menu_name_key(f.name) = public.menu_name_key(r.from_name)
  AND public.menu_name_key(r.from_name) <> public.menu_name_key(r.to_name)
  AND x.item_id = f.id;

INSERT INTO "public"."items" ("name", "item_type", "origin", "riff_of_id", "origin_bar_profile_id", "notes", "origin_year")
SELECT DISTINCT ON (p.id, public.menu_name_key(d.name))
    d.name, 'cocktail', CASE WHEN c.id IS NULL THEN 'Original' ELSE 'Varient' END, c.id, p.id, d.notes, d.origin_year::smallint
FROM "bh_drinks" d
JOIN "bh_bars" p ON p.handle = d.handle
LEFT JOIN LATERAL (
    SELECT c.id FROM "public"."items" c
    WHERE c.is_catalog AND c.item_type = 'cocktail' AND lower(btrim(c.name)) = lower(d.name)
    ORDER BY c.created_at LIMIT 1
) c ON true
WHERE NOT EXISTS (
    SELECT 1 FROM "public"."items" i
    WHERE i.item_type = 'cocktail' AND i.bar_id IS NULL AND i.origin_bar_profile_id = p.id AND public.menu_name_key(i.name) = public.menu_name_key(d.name)
)
ORDER BY p.id, public.menu_name_key(d.name);

ALTER TABLE "bh_drinks" ADD COLUMN "item_id" uuid;
UPDATE "bh_drinks" d SET "item_id" = (
    SELECT i.id FROM "public"."items" i JOIN "bh_bars" p ON p.handle = d.handle
    WHERE i.item_type = 'cocktail' AND i.bar_id IS NULL AND i.origin_bar_profile_id = p.id AND public.menu_name_key(i.name) = public.menu_name_key(d.name)
    ORDER BY (i.name = d.name) DESC, i.created_at, i.id LIMIT 1
);
DELETE FROM "bh_drinks" WHERE "item_id" IS NULL;
-- Two spellings of one drink ("Mr. Martinez", "Mr Martinez"): the first listed.
DELETE FROM "bh_drinks" d USING "bh_drinks" o WHERE d.item_id = o.item_id AND d.ctid > o.ctid;

-- Fill gaps on drinks that were already there; never overwrite.
UPDATE "public"."items" i SET
    "notes" = coalesce(i.notes, d.notes),
    "origin_year" = coalesce(i.origin_year, d.origin_year::smallint),
    "glassware_id" = coalesce(i.glassware_id, (
        SELECT g.id FROM "public"."items" g
        WHERE g.item_type = 'glassware' AND g.bar_id IS NULL AND lower(g.name) = lower(d.glass)
        ORDER BY g.created_at LIMIT 1
    ))
FROM "bh_drinks" d
WHERE i.id = d.item_id;

-- --- Ingredient lines, only for drinks that have none ---

ALTER TABLE "bh_lines" ADD COLUMN "item_id" uuid;
UPDATE "bh_lines" l SET "item_id" = d.item_id
FROM "bh_drinks" d
WHERE d.handle = l.handle AND public.menu_name_key(d.name) = public.menu_name_key(l.drink)
  AND NOT EXISTS (SELECT 1 FROM "public"."recipes" r WHERE r.recipe_item_id = d.item_id);
DELETE FROM "bh_lines" WHERE "item_id" IS NULL;

-- Shared ingredients, reusing one with the same name. New ones are a menu's
-- wording ("Redbreast 12 whiskey", "fermented plum") with no generic worked
-- out yet, so they stay out of ingredient search, as named bottles do.
INSERT INTO "public"."items" ("name", "item_type", "hide_from_search")
SELECT DISTINCT ON (lower(l.ingredient)) l.new_name, 'ingredient', true
FROM "bh_lines" l
WHERE NOT EXISTS (
    SELECT 1 FROM "public"."items" i WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL AND lower(i.name) = lower(l.ingredient)
)
ORDER BY lower(l.ingredient);

CREATE TEMP TABLE "bh_ingredients" AS
SELECT DISTINCT ON (lower(name)) lower(name) AS key, id
FROM "public"."items" WHERE item_type = 'ingredient' AND bar_id IS NULL
ORDER BY lower(name), is_catalog DESC, created_at;

-- A bottle the generics backfill (20260930960000) knows takes its generic
-- and spirit category as that backfill would, only where it has none.
UPDATE "public"."items" i SET "generic_id" = g.id
FROM (SELECT DISTINCT lower(ingredient) AS key, lower(generic) AS generic FROM "bh_lines" WHERE generic IS NOT NULL) l
JOIN "bh_ingredients" s ON s.key = l.key
JOIN "bh_ingredients" g ON g.key = l.generic
WHERE i.id = s.id AND i.generic_id IS NULL AND g.id <> i.id;

INSERT INTO "public"."item_categories" ("item_id", "category_id", "is_primary")
SELECT DISTINCT ON (s.id) s.id, c.id, true
FROM "bh_lines" l
JOIN "bh_ingredients" s ON s.key = lower(l.ingredient)
JOIN LATERAL (
    SELECT c.id FROM "public"."categories" c WHERE c.domain = 'spirit' AND c.name = l.category ORDER BY c.created_at LIMIT 1
) c ON true
WHERE l.category IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "public"."item_categories" x WHERE x.item_id = s.id)
ORDER BY s.id
ON CONFLICT DO NOTHING;

INSERT INTO "public"."recipes" ("recipe_item_id", "ingredient_item_id", "parent_ingredient_id", "amount", "unit",
                                "is_optional", "sort_order")
SELECT DISTINCT ON (l.item_id, i.id) l.item_id, i.id, ii.generic_id, NULL, NULL, false, l.pos
FROM "bh_lines" l
JOIN "bh_ingredients" i ON i.key = lower(l.ingredient)
JOIN "public"."items" ii ON ii.id = i.id
ORDER BY l.item_id, i.id, l.pos;

-- --- The drinks on each menu, after anything already on it ---

CREATE TEMP TABLE "bh_menu_rows" AS
SELECT DISTINCT ON (m.id, d.item_id) m.id AS edition_id, d.item_id, x.pos
FROM "bh_menu" x
JOIN "bh_bars" p ON p.handle = x.handle
JOIN "public"."profile_menu_editions" m
  ON m.profile_id = p.id AND m.name = x.edition AND m.year = x.year AND m.month IS NOT DISTINCT FROM x.month
JOIN "bh_drinks" d ON d.handle = x.handle AND public.menu_name_key(d.name) = public.menu_name_key(x.drink)
ORDER BY m.id, d.item_id, x.pos;

INSERT INTO "public"."profile_menu_edition_drinks" ("edition_id", "item_id", "sort_order")
SELECT r.edition_id, r.item_id, coalesce(o.next, 0) + r.pos
FROM "bh_menu_rows" r
LEFT JOIN (
    SELECT edition_id, max(sort_order) + 1 AS next FROM "public"."profile_menu_edition_drinks" GROUP BY edition_id
) o ON o.edition_id = r.edition_id
WHERE NOT EXISTS (
    SELECT 1 FROM "public"."profile_menu_edition_drinks" x WHERE x.edition_id = r.edition_id AND x.item_id = r.item_id
);

-- Names the earlier seeds put on a menu that the menu doesn't list (a section
-- title, another month's drink). The drink itself stays with the bar.
DELETE FROM "public"."profile_menu_edition_drinks" x
USING "bh_removes" r, "bh_bars" p, "public"."profile_menu_editions" m, "public"."items" i
WHERE p.handle = r.handle
  AND m.profile_id = p.id AND m.name = r.edition AND m.year = r.year AND m.month IS NOT DISTINCT FROM r.month
  AND x.edition_id = m.id AND i.id = x.item_id AND public.menu_name_key(i.name) = public.menu_name_key(r.drink);

-- --- Glassware, once 20261007100000_glass_variants is in ---

DO $$
BEGIN
    IF to_regclass('public.bar_glassware') IS NOT NULL THEN
        -- Only for a bar with no glassware yet: its own admins' edits win.
        EXECUTE $sql$
            INSERT INTO public.bar_glassware (profile_id, glass, variant, name, maker, designer, series, shape_note,
                                              source_urls, is_default, sort_order)
            SELECT p.id, g.glass, g.variant, g.name, g.maker, g.designer, g.series, g.shape_note,
                   g.source_urls, g.is_default, g.sort_order
            FROM bh_glassware g
            JOIN bh_bars p ON p.handle = g.handle
            WHERE NOT EXISTS (SELECT 1 FROM public.bar_glassware o WHERE o.profile_id = p.id)
        $sql$;
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'items' AND column_name = 'sketch_variant'
    ) THEN
        EXECUTE $sql$
            UPDATE public.items i SET sketch_variant = v.variant
            FROM bh_variants v
            JOIN bh_drinks d ON d.handle = v.handle AND public.menu_name_key(d.name) = public.menu_name_key(v.drink)
            WHERE i.id = d.item_id AND i.sketch_variant IS NULL
        $sql$;
    END IF;
END $$;

-- --- Put these drinks' flavour jobs back ---

CREATE TEMP TABLE "bh_touched" AS
SELECT item_id FROM "bh_drinks"
UNION
SELECT i.id FROM "public"."items" i
JOIN "bh_bars" p ON i.origin_bar_profile_id = p.id
JOIN "bh_renames" r ON r.handle = p.handle AND public.menu_name_key(i.name) = public.menu_name_key(r.to_name)
WHERE i.item_type = 'cocktail' AND i.bar_id IS NULL;

DELETE FROM "private"."item_flavor_jobs" j
USING "bh_touched" t
WHERE j.item_id = t.item_id AND NOT EXISTS (SELECT 1 FROM "bh_flavor_jobs" o WHERE o.item_id = j.item_id);
UPDATE "private"."item_flavor_jobs" j SET
    "status" = o.status, "revision" = o.revision, "attempts" = o.attempts, "run_after" = o.run_after,
    "lease_until" = o.lease_until, "last_error" = o.last_error, "updated_at" = o.updated_at
FROM "bh_flavor_jobs" o
JOIN "bh_touched" t ON t.item_id = o.item_id
WHERE j.item_id = o.item_id AND j.revision <> o.revision;

DROP TABLE "bh_touched", "bh_flavor_jobs", "bh_menu_rows", "bh_ingredients", "bh_bars", "bh_variants", "bh_glassware", "bh_removes", "bh_renames",
    "bh_menu", "bh_lines", "bh_drinks", "bh_editions";

RESET "app.image_worker";
`;
}

const mark = { found: 'yes', partial: 'partial', none_found: 'none found', not_searched: 'not searched' };

export function report(bars) {
  const head = '| Bar | Glassware | Current menu | History | Editions (new / corrected) | Menu drinks | Searches |\n|---|---|---|---|---|---|---|';
  const rows = bars.map((bar) => {
    const eds = (bar.editions || []).filter((e) => e.startDate.year != null);
    const fresh = eds.filter((e) => !e.existing).length;
    const corrected = eds.length - fresh;
    const drinks = eds.reduce((sum, e) => sum + (e.drinks || []).length, 0);
    const glass = (bar.glassware || []).map((g) => [g.maker, g.series].filter(Boolean).join(' ')).filter(Boolean).join(', ');
    const c = bar.coverage;
    return `| ${bar.name || bar.handle} | ${c.glassware === 'found' || c.glassware === 'partial' ? glass || mark[c.glassware] : mark[c.glassware]} | ${mark[c.current_menu]} | ${mark[c.history]} | ${fresh} / ${corrected} | ${drinks} | ${c.searches ?? 0} |`;
  });
  return `${head}\n${rows.join('\n')}\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const bars = load();
  if (process.argv.includes('--report')) process.stdout.write(report(bars));
  else if (process.argv.includes('--print')) process.stdout.write(build(bars));
  else writeFileSync(OUT, build(bars));
}
