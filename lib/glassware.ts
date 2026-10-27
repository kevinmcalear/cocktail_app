// A bar's glassware (bar_glassware): the names of the glass types and the
// limits the database checks (20261007100000_glass_variants.sql).

import { glassSizeLabel } from './glass';
import { variantsOf } from './sketch/geometry';
import { SKETCH_GLASSES, type SketchGlass } from '@/lib/sketch/types';

import { GLASSES, glassFromName, iceFromName, ICES, itemGlass, type Kinded } from '../supabase/functions/_shared/sketchRules';

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

/** A glass picked ("Coupe", "Champagne saucer", its kind before its name) is one of the venue's when it lists a glass of that type. */
export function isVenueGlassName(rows: readonly OwnedGlass[], picked: Kinded): boolean {
  const glass = itemGlass(picked);
  return !!glass && rows.some((r) => r.glass === glass);
}

/**
 * A new glass or ice item's kind as it saves (items.glass, items.ice_kind):
 * only a kind the database takes, nothing for Not sure (null) or another type.
 * Set once, when the item is made: after that only an admin may change it.
 */
export function kindColumns(type: string, kind: string | null | undefined): { glass?: SketchGlass; ice_kind?: string } {
  if (type === 'glassware' && (GLASSES as readonly string[]).includes(kind ?? '')) return { glass: kind as SketchGlass };
  if (type === 'ice' && (ICES as readonly string[]).includes(kind ?? '')) return { ice_kind: kind! };
  return {};
}

/** A new glass or ice, guessed from the name being typed ("Tiki bowl" is a tiki mug), for the question under the field. Never no ice: that's picked, not typed. */
export function typedKind(of: 'glass' | 'ice', name: string): string | null {
  if (of === 'glass') return glassFromName(name);
  const ice = iceFromName(name);
  return ice === 'none' ? null : ice;
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
