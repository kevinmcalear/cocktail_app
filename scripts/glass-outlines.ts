// Turns supabase/seeds/glass-outlines/*.json (each catalog glass's traced
// outline, keyed by its maker, name and size) into the load migrations, one
// per folder (wave5/ for wave 5's glasses). One source of truth:
// scripts/glass-outlines.check.ts fails if they drift.
//
//   node --import tsx scripts/glass-outlines.ts           write the migrations
//   node --import tsx scripts/glass-outlines.ts --print   print them instead
//
// The seeds came from the one-off trace of every catalog glass (24 and 25 Oct
// 2026, outside the repo): photos were read there and never kept.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { readOutline, type GlassOutline } from '../lib/sketch/outline';

const DIR = 'supabase/seeds/glass-outlines';

/** One migration: the folder of seeds it loads, and what its header says above the generated note. */
export interface OutlineLoad {
  file: string;
  dir: string;
  header: (count: number) => string;
  /** Only glasses with no outline yet: a later load never redraws one an earlier load traced. */
  onlyUntraced?: boolean;
}

export const LOADS: OutlineLoad[] = [
  {
    file: 'supabase/migrations/20261113110000_glass_outlines_load.sql',
    dir: DIR,
    header: (count) => `-- Glass outlines, load 1: the catalog's glasses, after 20261113100000.
--
--   * ${count} of the catalog's glasses get their traced outline. Each was
--     traced from its maker's (or a stockist's) product photo and scaled to
--     the height the maker publishes; traced_from cites the photo's page. The
--     photos were read once and never kept; no text was copied.
--   * Accuracy: drawn outline against the photo, median fit 0.998; traced
--     widest diameter against the maker's published one (1,254 glasses),
--     median 2.2% off, 80% within 5%. 274 traces were checked by eye.
--   * Nude's five Savage glasses were traced from their stockist's listings
--     (Webstaurant; Steelite distributes Nude): the same items and heights.
--   * Left out: glasses whose trace failed or was rejected by eye, and four
--     whose catalog height disagrees with the photo (Libbey 125, Urban Bar
--     UB3807, UB6375, UB5284): the catalog fact needs a look first.
--   * Setting an outline redraws the drinks served in that glass
--     (20261113100000 refresh_sketches). A second run changes nothing.`,
  },
  {
    file: 'supabase/migrations/20261113410000_glass_outlines_wave5.sql',
    dir: join(DIR, 'wave5'),
    onlyUntraced: true,
    header: (count) => `-- Glass outlines, load 2: wave 5's glasses, after 20261113400000 (which
-- adds them) and load 1 (20261113110000).
--
--   * ${count} glasses get their traced outline: wave 5's new glasses, and
--     catalog glasses load 1 left without one. Traced as load 1 was, from the
--     maker's (or a stockist's) product photo, scaled to the published height
--     and checked against the published width and capacity, or passed by eye
--     on a contact sheet; traced_from cites the photo's page. Toyo-Sasaki's
--     were retraced from the maker's own photos. No photo or text is kept.
--   * Copper, steel and glazed pieces carry their material and colour; a
--     handle or a sleeve its place.
--   * Accuracy: drawn outline against the photo, median fit 0.998;
--     traced widest diameter against the maker's published one (831
--     glasses), median 2.1% off, 81% within 5%. Flagged traces and every
--     Toyo-Sasaki glass were checked by eye on contact sheets.
--   * A glass load 1 already outlined is left as it is. A second run
--     changes nothing.`,
  },
];

export interface OutlineSeed {
  /** The maker page's handle (profiles.handle). */
  maker: string;
  outlines: { name: string; capacity_ml: number | null; outline: GlassOutline & { traced_from: string } }[];
}

export function readSeeds(dir = DIR): OutlineSeed[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as OutlineSeed);
}

/** Why an outline can't load, or null. */
export function outlineProblem(o: unknown): string | null {
  const x = o as Partial<GlassOutline & { traced_from: string }> | null;
  if (!readOutline(x)) return 'not an outline the painter can draw';
  if (typeof x!.traced_from !== 'string' || !/^https:\/\/[^\s]+$/.test(x!.traced_from)) return 'traced_from is not an https page';
  const last = x!.outline![x!.outline!.length - 1][0];
  const bottom = x!.stemmed ? x!.foot_profile?.at(-1)?.[0] ?? x!.stem_to_mm! : last;
  if (Math.abs(bottom - x!.height_mm!) > 1) return `ends at ${bottom} mm, not its height ${x!.height_mm} mm`;
  return null;
}

const q = (s: string | null | undefined) => (s == null ? 'NULL' : `$q$${s}$q$`);

export function render(load: OutlineLoad, seeds = readSeeds(load.dir)): string {
  const rows = seeds.flatMap((s) =>
    s.outlines.map((o) => {
      const problem = outlineProblem(o.outline);
      if (problem) throw new Error(`${s.maker} ${o.name}: ${problem}`);
      return `(${[q(s.maker), q(o.name), o.capacity_ml ?? 'NULL', q(JSON.stringify(o.outline))].join(', ')})`;
    })
  );
  return `${load.header(rows.length)}
--
-- Generated by scripts/glass-outlines.ts from ${load.dir}/.

UPDATE public.glass_models m
   SET outline = o.outline::jsonb
  FROM (VALUES
${rows.join(',\n')}
  ) o(maker, name, capacity_ml, outline)
  JOIN public.profiles p ON p.kind = 'maker' AND p.handle = o.maker
 WHERE m.maker_profile_id = p.id
   AND public.ingredient_key(m.name) = public.ingredient_key(o.name)
   AND coalesce(m.capacity_ml, 0) = coalesce(o.capacity_ml::numeric, 0)
   AND m.outline IS DISTINCT FROM o.outline::jsonb${load.onlyUntraced ? '\n   AND m.outline IS NULL' : ''};
`;
}

if (process.argv[1]?.endsWith('glass-outlines.ts')) {
  for (const load of LOADS) {
    const sql = render(load);
    if (process.argv.includes('--print')) process.stdout.write(sql);
    else writeFileSync(load.file, sql);
  }
}
