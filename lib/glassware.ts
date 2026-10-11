// A bar's glassware (bar_glassware): the names of the glass types and the
// limits the database checks (20261007100000_glass_variants.sql).

import { SKETCH_GLASSES, type SketchGlass } from '@/lib/sketch/types';

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

export interface GlassFields {
  name: string;
  maker: string;
  designer: string;
  series: string;
  shape_note: string;
}

/** The field the database would refuse, with the reason, or null. Text is trimmed; empty is fine. */
export function glassFieldProblem(f: GlassFields): { field: keyof GlassFields; message: string } | null {
  for (const field of ['name', 'maker', 'designer', 'series'] as const) {
    if (f[field].trim().length > 80) return { field, message: 'Keep it to 80 characters.' };
  }
  if (f.shape_note.length > 500) return { field: 'shape_note', message: 'Keep it to 500 characters.' };
  return null;
}

/** What a glass is called in a list: its own name, else its type. */
export const glassTitle = (g: { name: string | null; glass: SketchGlass }) => g.name?.trim() || GLASS_TYPE_LABEL[g.glass];

/** Trimmed text, or null when empty (the columns hold null, not ''). */
export const textOrNull = (s: string) => (s.trim() ? s.trim() : null);
