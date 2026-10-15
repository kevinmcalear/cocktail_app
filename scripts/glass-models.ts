// Turns supabase/seeds/glass-models/*.json (facts from makers' own catalogs,
// each row citing its pages) into the glass model load migrations. One source
// of truth: scripts/glass-models.check.ts fails if a migration drifts.
//
//   node --import tsx scripts/glass-models.ts           write the migrations
//   node --import tsx scripts/glass-models.ts --print   print them instead
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { GLASS_VARIANTS } from '../lib/sketch/geometry';
import type { SketchGlass } from '../lib/sketch/types';

const DIR = 'supabase/seeds/glass-models';

export interface SeedModel {
  name: string;
  series: string | null;
  designer: string | null;
  model_code: string | null;
  glass: SketchGlass;
  /** The researcher's pick of drawing, checked in the audit; null lets drawingFor decide. */
  variant: string | null;
  capacity_ml: number | null;
  capacity_as_stated: string | null;
  height_mm: number | null;
  rim_mm: number | null;
  material: string | null;
  product_url: string | null;
  source_urls: string[];
}

export interface Seed {
  /** The maker page's handle (profiles.handle). */
  maker: string;
  models: SeedModel[];
}

/** One migration: which makers' files it loads, and what its header says. */
interface Load {
  file: string;
  makers: string[];
  header: string;
}

export const LOADS: Load[] = [
  {
    file: 'supabase/migrations/20261026200000_glass_models_bar_supply.sql',
    makers: ['libbey', 'urban.bar'],
    header: `
-- Glass models, load 1 of 2: bar-supply houses, after 20261026100000.
-- Kevin, 15 Oct 2026: a model-level glass catalog ("every coupe in
-- existence that you can buy", 7 Oct jam).
--
--   * Libbey 331, from its foodservice site's listing pages (item numbers
--     as model codes). Urban Bar 178, from its own store (its own lines only;
--     trade-only pages checked through the public box-pack page).
--   * Cocktail and spirits glasses only (wave 1); wine and beer glasses wait.
--   * Facts only, each row citing the maker's pages; no copied text or
--     photos. Drawings stay ours: each model gets the nearest of our variants.
--   * Audit: an independent re-check of 100 random rows (70 Libbey, 30 Urban
--     Bar). Libbey's 2 wrong were a widest diameter stored as the rim; no
--     maker here publishes a rim, so rim_mm is empty on every row. Urban Bar's
--     2 wrong (a series, a drawing) are fixed, with the same series mistake on
--     sibling rows. 2 of 100 wrong at audit time, at the 2% bar.`,
  },
  {
    file: 'supabase/migrations/20261026300000_glass_models_crystal.sql',
    makers: ['schott.zwiesel', 'spiegelau', 'riedel'],
    header: `
-- Glass models, load 2 of 2: crystal houses, after 20261026200000.
--
--   * Schott Zwiesel 41, from the maker's Consumer Katalog 2026 (its web
--     pages sit behind a Cloudflare challenge; the PDF on its own domain
--     loads). Spiegelau 71 and Riedel 61, from the makers' product pages;
--     Riedel's full capacity is read off its own measured drawings (the
--     spec table's "CapacityRec" is the pour, not the glass).
--   * Cocktail and spirits glasses only (wave 1); wine and beer glasses wait.
--   * Facts only, each row citing the maker's pages; no copied text or
--     photos. Drawings stay ours: each model gets the nearest of our variants.
--   * Audit: an independent re-check of 100 random rows found 6 wrong, all
--     the same fault (a widest-diameter figure stored as the rim). No maker
--     here publishes a rim, so rim_mm is left empty on every row; after that,
--     0 of 100 wrong. Spiegelau states no capacity in its page text, so most
--     of its rows have none.`,
  },
];

// The catalog shape each type of glass is a kind of (a shared glassware item).
// Prod has all but Snifter, Mug and Tiki Mug; a load adds those it needs.
export const SHAPE_NAME: Partial<Record<SketchGlass, string>> = {
  coupe: 'Coupe',
  nick: 'Nick & Nora',
  martini: 'Martini',
  rocks: 'Rocks',
  highball: 'Highball',
  collins: 'Collins',
  fizz: 'Fizz',
  flute: 'Flute',
  spritz: 'Spritz',
  snifter: 'Snifter',
  julep: 'Julep Cup',
  tiki: 'Tiki Mug',
  mug: 'Mug',
};

export const MATERIALS = ['glass', 'crystal', 'lead-free crystal', 'ceramic', 'metal', 'plastic'];

const isVariant = (glass: SketchGlass, v: string | null | undefined) => !!v && (GLASS_VARIANTS[glass] ?? []).some((x) => x.key === v);

/**
 * The drawing a model gets: the researcher's pick when it is one of its
 * glass's, else what its name or size says (a shot, a double old fashioned,
 * a saucer, an Irish coffee glass), else the type's default (null).
 */
export function drawingFor(m: Pick<SeedModel, 'glass' | 'variant' | 'name' | 'capacity_ml' | 'material'>): string | null {
  if (isVariant(m.glass, m.variant)) return m.variant;
  const name = m.name.toLowerCase();
  const ml = m.capacity_ml ?? null;
  const pick = (v: string) => (isVariant(m.glass, v) ? v : null);
  switch (m.glass) {
    case 'rocks':
      if (/\bshot\b|shooter/.test(name) || (ml !== null && ml <= 90)) return pick('rocks_shot');
      if (/double|\bdof\b/.test(name) || (ml !== null && ml > 320)) return pick('rocks_double');
      return null;
    case 'coupe':
      return /saucer/.test(name) ? pick('coupe_saucer') : null;
    case 'nick':
      return ml !== null && ml < 130 ? pick('nick_little') : null;
    case 'martini':
      return ml !== null && ml < 120 ? pick('martini_pony') : null;
    case 'collins':
      if (/zombie/.test(name)) return pick('collins_zombie');
      if (/hurricane|poco grande/.test(name)) return pick('collins_hurricane');
      return null;
    case 'flute':
      return /tulip/.test(name) ? pick('flute_tulip') : null;
    case 'snifter':
      return /glencairn|nosing|whisky taster|tasting/.test(name) ? pick('snifter_glencairn') : null;
    case 'mug':
      if (/copper/.test(name) || m.material === 'metal') return pick('mug_copper');
      if (/irish/.test(name)) return pick('mug_irish');
      return pick('mug_toddy');
    default:
      return null;
  }
}

/** Why a row can't load, or null. */
export function problemWith(m: SeedModel): string | null {
  if (!SHAPE_NAME[m.glass]) return `type ${m.glass} is not in scope`;
  if (!m.name?.trim() || m.name.length > 120) return 'name';
  if (m.variant && !isVariant(m.glass, m.variant)) return `drawing ${m.variant} is not a ${m.glass}'s`;
  if (m.material && !MATERIALS.includes(m.material)) return `material ${m.material}`;
  for (const n of [m.capacity_ml, m.height_mm, m.rim_mm]) if (n !== null && !(n > 0 && n < 5000)) return 'a measure out of range';
  const urls = [...m.source_urls, ...(m.product_url ? [m.product_url] : [])];
  if (!m.source_urls.length || m.source_urls.length > 10) return 'sources';
  if (urls.some((u) => !/^https:\/\/[^\s]+$/.test(u) || u.length > 500)) return 'a source that is not an https page';
  if (/[\u2014\u2013]/.test(JSON.stringify(m))) return 'a long dash';
  return null;
}

const q = (s: string | null | undefined) => (s == null ? 'NULL' : `$q$${s}$q$`);
const n = (x: number | null | undefined) => (x == null ? 'NULL' : String(x));
const arr = (xs: string[]) => `ARRAY[${xs.map(q).join(', ')}]::text[]`;

export function readSeed(handle: string): Seed {
  return JSON.parse(readFileSync(join(DIR, `${handle}.json`), 'utf8')) as Seed;
}

/** The rows a load writes: valid, one per maker, name and size (the first wins). */
export function rowsOf(seeds: Seed[]) {
  const seen = new Set<string>();
  const rows: (SeedModel & { maker: string })[] = [];
  for (const seed of seeds) {
    for (const m of seed.models) {
      const problem = problemWith(m);
      if (problem) throw new Error(`${seed.maker} ${m.name}: ${problem}`);
      const key = `${seed.maker}\0${m.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}\0${m.capacity_ml ?? 0}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ ...m, maker: seed.maker, variant: drawingFor(m) });
    }
  }
  return rows;
}

export function render(load: Load): string {
  const rows = rowsOf(load.makers.map(readSeed));
  const shapes = [...new Set(rows.map((r) => SHAPE_NAME[r.glass]!))].sort();
  const values = rows
    .map(
      (r) =>
        `(${[q(r.maker), q(r.glass), q(SHAPE_NAME[r.glass]), q(r.variant), q(r.name), q(r.series), q(r.designer), q(r.model_code), n(r.capacity_ml), q(r.capacity_as_stated), n(r.height_mm), n(r.rim_mm), q(r.material), q(r.product_url), arr(r.source_urls)].join(', ')})`
    )
    .join(',\n');
  return `${load.header.trim()}
--
-- Generated by scripts/glass-models.ts from supabase/seeds/glass-models/
-- (${load.makers.join(', ')}): ${rows.length} models. A second run changes nothing more.

-- The catalog shapes these glasses are kinds of, where the catalog lacks one.
INSERT INTO public.items (name, item_type)
SELECT s.name, 'glassware'
  FROM (VALUES ${shapes.map((s) => `(${q(s)})`).join(', ')}) s(name)
 WHERE NOT EXISTS (SELECT 1 FROM public.items i WHERE i.item_type = 'glassware' AND i.bar_id IS NULL AND lower(i.name) = lower(s.name));

CREATE TEMP TABLE glass_in (maker text, glass text, shape text, variant text, name text, series text, designer text, model_code text,
  capacity_ml numeric, capacity_as_stated text, height_mm numeric, rim_mm numeric, material text, product_url text, source_urls text[]);
INSERT INTO glass_in VALUES
${values};

-- Every maker named here has its page.
DO $$
DECLARE v_missing text;
BEGIN
  SELECT string_agg(DISTINCT g.maker, ', ') INTO v_missing FROM glass_in g
   WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.kind = 'maker' AND p.handle = g.maker AND 'glassware' = ANY (p.makes));
  IF v_missing IS NOT NULL THEN RAISE EXCEPTION 'No glassware maker page for: %', v_missing; END IF;
END;
$$;

INSERT INTO public.glass_models (maker_profile_id, shape_item_id, glass, variant, name, series, designer, model_code,
                                 capacity_ml, capacity_as_stated, height_mm, rim_mm, material, product_url, source_urls)
SELECT p.id,
       (SELECT i.id FROM public.items i WHERE i.item_type = 'glassware' AND i.bar_id IS NULL AND lower(i.name) = lower(g.shape) ORDER BY i.created_at, i.id LIMIT 1),
       g.glass, g.variant, g.name, g.series, g.designer, g.model_code, g.capacity_ml, g.capacity_as_stated, g.height_mm, g.rim_mm,
       g.material, g.product_url, g.source_urls
  FROM glass_in g
  JOIN public.profiles p ON p.kind = 'maker' AND p.handle = g.maker
ON CONFLICT (maker_profile_id, public.ingredient_key(name), coalesce(capacity_ml, 0)) DO UPDATE SET
    shape_item_id = EXCLUDED.shape_item_id, glass = EXCLUDED.glass, variant = EXCLUDED.variant, series = EXCLUDED.series,
    designer = EXCLUDED.designer, model_code = EXCLUDED.model_code, capacity_as_stated = EXCLUDED.capacity_as_stated,
    height_mm = EXCLUDED.height_mm, rim_mm = EXCLUDED.rim_mm, material = EXCLUDED.material,
    product_url = EXCLUDED.product_url, source_urls = EXCLUDED.source_urls
  WHERE (glass_models.shape_item_id, glass_models.glass, glass_models.variant, glass_models.series, glass_models.designer, glass_models.model_code,
         glass_models.capacity_as_stated, glass_models.height_mm, glass_models.rim_mm, glass_models.material, glass_models.product_url, glass_models.source_urls)
        IS DISTINCT FROM (EXCLUDED.shape_item_id, EXCLUDED.glass, EXCLUDED.variant, EXCLUDED.series, EXCLUDED.designer, EXCLUDED.model_code,
         EXCLUDED.capacity_as_stated, EXCLUDED.height_mm, EXCLUDED.rim_mm, EXCLUDED.material, EXCLUDED.product_url, EXCLUDED.source_urls);

-- A venue's glass already named by this maker and this model's name (one size
-- only, so it can't be the wrong one) now points at it.
UPDATE public.bar_glassware b SET model_id = m.id
  FROM public.glass_models m
 WHERE b.model_id IS NULL AND b.maker_profile_id = m.maker_profile_id
   AND public.ingredient_key(b.name) = public.ingredient_key(m.name)
   AND m.maker_profile_id IN (SELECT p.id FROM public.profiles p WHERE p.handle IN (SELECT DISTINCT maker FROM glass_in))
   AND (SELECT count(*) FROM public.glass_models x WHERE x.maker_profile_id = m.maker_profile_id
          AND public.ingredient_key(x.name) = public.ingredient_key(m.name)) = 1;

DROP TABLE glass_in;
`;
}

function main() {
  const print = process.argv.includes('--print');
  for (const load of LOADS) {
    const sql = render(load);
    if (print) process.stdout.write(`-- FILE ${load.file}\n${sql}`);
    else writeFileSync(load.file, sql);
  }
}

if (process.argv[1]?.endsWith('glass-models.ts')) main();
