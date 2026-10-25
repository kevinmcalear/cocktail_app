// A bar's glassware (bar_glassware): the names of the glass types and the
// limits the database checks (20261007100000_glass_variants.sql).

import { glassSizeLabel } from './glass';
import { variantsOf } from './sketch/geometry';
import { SKETCH_GLASSES, type SketchGlass } from '@/lib/sketch/types';

import { glassFromName } from '../supabase/functions/_shared/sketchRules';

export const GLASS_TYPE_LABEL: Record<SketchGlass, string> = {
  coupe: 'Coupe',
  nick: 'Nick & Nora',
  martini: 'Martini',
  rocks: 'Rocks',
  highball: 'Highball',
  collins: 'Collins',
  fizz: 'Fizz',
  flute: 'Flute',
  wine: 'Wine glass',
  spritz: 'Spritz glass',
  snifter: 'Snifter',
  julep: 'Julep cup',
  tiki: 'Tiki mug',
  mug: 'Mug',
  ceramic: 'Ceramic vessel',
  beer: 'Beer glass',
};

export const GLASS_TYPES: readonly SketchGlass[] = SKETCH_GLASSES;

/** What a glass is called in a list: its own name, else its type. */
export const glassTitle = (g: { name: string | null; glass: SketchGlass }) => g.name?.trim() || GLASS_TYPE_LABEL[g.glass];

// --- the "Is this one of your glasses?" prompt (add-drink wizard, drink editor) ---

/** What the prompt and pickers read from a venue's glass. */
interface OwnedGlass {
  glass: SketchGlass;
  variant: string | null;
  name?: string | null;
  is_default?: boolean;
}

/**
 * A glass's drawing as bar_glassware stores it: null for its type's first
 * drawing (the default), else the GLASS_VARIANTS key. A key for another glass
 * counts as the default too, like the sketch does.
 */
export function drawingKey(glass: SketchGlass, variant: string | null | undefined): string | null {
  if (!variant?.startsWith(`${glass}_`)) return null;
  return variant === variantsOf(glass)[0]?.key ? null : variant;
}

/** Whether the venue lists this glass, in this drawing. */
export const hasGlass = (rows: readonly OwnedGlass[], glass: SketchGlass, variant: string | null | undefined) =>
  rows.some((r) => r.glass === glass && drawingKey(glass, r.variant) === drawingKey(glass, variant));

/** A glass picked by name ("Coupe", "Champagne saucer") is one of the venue's when it lists a glass of that type. */
export function isVenueGlassName(rows: readonly OwnedGlass[], name: string | null | undefined): boolean {
  const glass = glassFromName(name);
  return !!glass && rows.some((r) => r.glass === glass);
}

/** Where "Not now" is kept on this device: one answer per venue, glass and drawing. */
export const glassPromptKey = (barId: string, glass: SketchGlass, variant: string | null | undefined) => `${barId}:${glass}:${drawingKey(glass, variant) ?? ''}`;

/**
 * A venue glass's size, from the glassware item of the same name (the venue's
 * own first): bar_glassware has no size of its own.
 * ponytail: matched by name; give bar_glassware an item id if names drift.
 */
export function glassCapacity(
  row: OwnedGlass,
  items: readonly { name: string | null; bar_id?: string | null; capacity_ml?: number | null; iced_capacity_ml?: number | null }[],
  barId?: string | null
): string | null {
  const want = glassTitle({ name: row.name ?? null, glass: row.glass }).trim().toLowerCase();
  const same = items.filter((i) => i.name?.trim().toLowerCase() === want);
  const item = same.find((i) => barId && i.bar_id === barId) ?? same[0];
  return item ? glassSizeLabel({ capacity_ml: item.capacity_ml, iced_capacity_ml: item.iced_capacity_ml }) : null;
}
