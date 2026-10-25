// Kit and Buying in a venue's settings (supabase/migrations/20261019000000_venue_kit.sql,
// 20261110100000_kit_and_ice.sql): the ice it pours (item_ice), the tools it
// has (bar_kit), and what its suppliers bring.

import { andList } from './makers';
import { SUPPLIES, type Supplies } from './suppliers';
import { equipmentById } from './techniques/equipment';

/** The ice kinds the drawings know, less 'none'. */
export const ICE_KINDS = ['cubes', 'large', 'spear', 'crushed', 'pebble', 'shaved', 'sphere'] as const;
export type IceKind = (typeof ICE_KINDS)[number];

/** A venue ice's shape (item_ice.shape): the drawings' kinds, cut to size, something else, and the block and slab it's cut from. */
export const ICE_SHAPES = [...ICE_KINDS, 'cut', 'other', 'block', 'slab'] as const;
export type IceShape = (typeof ICE_SHAPES)[number];

/** What the drawings draw a venue's ice as: its shape, or for cut to size and something else the kind it's drawn as. Null for a block or slab. */
export function iceDrawKind(ice: { shape: string; draw_as: string | null }): IceKind | null {
  const kind = ice.draw_as ?? ice.shape;
  return (ICE_KINDS as readonly string[]).includes(kind) ? (kind as IceKind) : null;
}

/** An ice that goes in the glass, not a block or slab to cut from. */
export const inTheGlass = (ice: { shape: string }) => ice.shape !== 'block' && ice.shape !== 'slab';

/** A venue ice's shape in the Add sheet's words (Kit and ice, step 4): the Collins block is the spear. */
export const ICE_SHAPE_LABEL: Record<IceShape, string> = {
  cubes: 'Cubes',
  large: 'Large cube',
  spear: 'Collins block',
  sphere: 'Sphere',
  cut: 'Cut to size',
  crushed: 'Crushed',
  pebble: 'Pebble',
  shaved: 'Shaved',
  other: 'Something else',
  block: 'Block',
  slab: 'Slab',
};

/** The shapes in the glass, in the sheet's order. */
export const GLASS_ICE_SHAPES: readonly IceShape[] = ['cubes', 'large', 'spear', 'sphere', 'cut', 'crushed', 'pebble', 'shaved', 'other'];

/**
 * The sizes offered for a shape, in mm: a cube's side, a sphere's across, a
 * Collins block's length (`length`). None for crushed, pebble and shaved.
 */
export function iceSizes(shape: IceShape): { length: boolean; mm: readonly number[] } | null {
  if (shape === 'cubes') return { length: false, mm: [25, 32] };
  if (shape === 'large') return { length: false, mm: [32, 45, 50, 60] };
  if (shape === 'sphere') return { length: false, mm: [50, 60, 70] };
  if (shape === 'spear') return { length: true, mm: [100, 120, 140] };
  if (shape === 'cut' || shape === 'other') return { length: false, mm: [] };
  if (shape === 'block' || shape === 'slab') return { length: true, mm: [] };
  return null;
}

type IceLooks = { shape: IceShape; size_mm?: number | null; length_mm?: number | null; clear?: boolean | null };

/** The mm the name and the list show: a Collins block's, block's or slab's length, else its size. */
export function iceMm(ice: IceLooks): number | null {
  const sizes = iceSizes(ice.shape);
  return (sizes ? (sizes.length ? ice.length_mm : ice.size_mm) : null) ?? null;
}

/** The name the sheet gives an ice: "Clear cube · 50 mm", "Collins block · 120 mm", "Cubes". Empty for something else. */
export function iceName(ice: IceLooks): string {
  if (ice.shape === 'other') return '';
  const base = ice.clear && ice.shape === 'large' ? 'Clear cube' : ice.clear && ice.shape !== 'block' && ice.shape !== 'slab' ? `Clear ${ICE_SHAPE_LABEL[ice.shape].toLowerCase()}` : ICE_SHAPE_LABEL[ice.shape];
  const mm = iceMm(ice);
  return mm ? `${base} · ${mm} mm` : base;
}

/** What an ice looks like, in one line: "Large cube · 50 mm · clear · stamped". */
export function iceLooksLine(ice: IceLooks & { stamped?: boolean; frozen_inside?: string | null }): string {
  const mm = iceMm(ice);
  return [ICE_SHAPE_LABEL[ice.shape], mm ? `${mm} mm` : null, ice.clear == null ? null : ice.clear ? 'clear' : 'cloudy', ice.stamped ? 'stamped' : null, ice.frozen_inside ? `${ice.frozen_inside} inside` : null]
    .filter(Boolean)
    .join(' · ');
}

/** A count the database takes (bar_kit.count, bar_glassware.count): empty, or a whole number from 1 to 9999. */
export function kitCount(text: string): { n: number | null; ok: boolean } {
  const n = text.trim() ? Number(text.trim()) : null;
  return { n, ok: n == null || (Number.isInteger(n) && n >= 1 && n <= 9999) };
}

/** A list row's one line: "Prep kitchen · 2 · already ours", the parts after the first starting small. */
export function kitLine(parts: readonly (string | null | undefined)[]): string {
  return parts
    .filter((p): p is string => !!p)
    .map((p, i) => (i ? p[0].toLowerCase() + p.slice(1) : p))
    .join(' · ');
}

/** Where a tool is (bar_kit.location). */
export const TOOL_LOCATION_LABEL: Record<'bar' | 'prep', string> = { bar: 'Behind the bar', prep: 'Prep kitchen' };

/** A venue's tool by its own name, else ours (lib/techniques/equipment.ts), else its key. */
export const toolName = (t: { name: string | null; key: string | null }) => t.name ?? (t.key ? (equipmentById(t.key)?.name ?? t.key) : 'A tool');

// The kinds a guessed ice gives way to, nearest first: big cubes for cubes,
// the crushed family for crushed. Kept in step with private.house_ice
// (supabase/migrations/20261019600000_venue_ice_drawings.sql).
const NEAR: Record<IceKind, readonly IceKind[]> = {
  cubes: ['cubes', 'large', 'sphere', 'spear'],
  large: ['large', 'sphere', 'cubes'],
  sphere: ['sphere', 'large', 'cubes'],
  spear: ['spear', 'cubes', 'large'],
  crushed: ['crushed', 'pebble', 'shaved', 'cubes'],
  pebble: ['pebble', 'crushed', 'shaved', 'cubes'],
  shaved: ['shaved', 'crushed', 'pebble', 'cubes'],
};

/**
 * The venue's own ice for a drink whose ice was guessed: the guess when the
 * venue has it, else its nearest kind the venue has. Null when there's
 * nothing to change: no ice, a venue with no ice listed, or nothing near.
 */
export function houseIce(ice: string, kinds: readonly string[]): IceKind | null {
  if (!kinds.length || !(ice in NEAR) || kinds.includes(ice)) return null;
  return NEAR[ice as IceKind].find((k) => kinds.includes(k)) ?? null;
}

/** The venue's ice in the glass by its names, in its order ("Cubes", "Large cube"). */
export function venueIceNames(rows: readonly { name: string; shape: string }[]): string[] {
  return rows.filter(inTheGlass).map((r) => r.name);
}

/** The kinds the venue's ice is drawn as, for drawing a drink whose ice was guessed (private.item_sketches_set_house_ice). */
export function venueIceKinds(rows: readonly { shape: string; draw_as: string | null }[]): IceKind[] {
  return rows.flatMap((r) => {
    const kind = inTheGlass(r) ? iceDrawKind(r) : null;
    return kind ? [kind] : [];
  });
}

/** Whether a wizard pick is one of the venue's ice, by name ("large cube" is "Large cube"). */
export const isVenueIce = (names: readonly string[], name: string) => names.some((n) => n.toLowerCase() === name.trim().toLowerCase());

/** The venue's ice in the glass by a wizard pick's name ("spear" is "Spear"), or null. */
export const kitIceRow = <T extends { name: string; shape: string }>(rows: readonly T[], name: string): T | null =>
  rows.find((r) => inTheGlass(r) && isVenueIce([r.name], name)) ?? null;

// What a supplier brings uses lib/suppliers.ts's SUPPLIES, the list profiles and suppliers both check.
export const SUPPLY_LABEL: Record<Supplies, string> = {
  bottles: 'Bottles',
  ice: 'Ice',
  produce: 'Produce',
  garnish: 'Garnish',
  glassware: 'Glassware',
  barware: 'Barware',
  equipment: 'Equipment',
};

/** "Bottles and glassware · Order by Tue 2 pm", leaving out what isn't said. */
export function supplierLine(s: { supplies: readonly string[]; order_by: string | null; delivers: string | null }): string {
  const words = SUPPLIES.filter((k) => s.supplies.includes(k)).map((k, i) => (i ? SUPPLY_LABEL[k].toLowerCase() : SUPPLY_LABEL[k]));
  return [words.length ? andList(words) : null, s.order_by ? `Order by ${s.order_by}` : null, s.delivers ? `Delivers ${s.delivers}` : null]
    .filter(Boolean)
    .join(' · ');
}

const MADE: Record<string, string> = { made: 'Made here', machine: 'Our machine', ours: 'Already ours' };

/** Where an ice, tool or glass comes from: "Our machine · Hoshizaki under the well", "Bought from Coldwater Ice Co. · 130 mm", or just its note. */
export function kitSourceLine(row: { source: string | null; supplier_name: string | null; machine?: string | null; note: string | null; length_mm?: number | null }): string {
  const from = row.source === 'bought' ? (row.supplier_name ? `Bought from ${row.supplier_name}` : 'Bought') : row.source ? (MADE[row.source] ?? null) : null;
  return [from, row.machine, row.note, row.length_mm ? `${row.length_mm} mm` : null].filter(Boolean).join(' · ');
}

/** A tool a step names, by name: ours (an equipment id) or the venue's own, as typed. */
export const toolLabel = (tool: string) => equipmentById(tool)?.name ?? tool;

/** Whether the venue's tools have one a step names: ours by id, its own by name. */
export const kitHasTool = (rows: readonly { key: string | null; name: string | null }[], tool: string) =>
  rows.some((r) => r.key === tool || (!!r.name && r.name.trim().toLowerCase() === tool.trim().toLowerCase()));
