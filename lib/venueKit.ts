// Kit and Buying in a venue's settings (supabase/migrations/20261019000000_venue_kit.sql):
// the ice it pours, the tools it has, and what its suppliers bring.

import { andList } from './makers';
import { SUPPLIES, type Supplies } from './suppliers';
import { EQUIPMENT } from './techniques/equipment';

/** The ice kinds a venue can list: the drawings' kinds less 'none' (the bar_kit_key_check list). */
export const ICE_KINDS = ['cubes', 'large', 'spear', 'crushed', 'pebble', 'shaved', 'sphere'] as const;
export type IceKind = (typeof ICE_KINDS)[number];

/** In the add-drink wizard's words (lib/drinkWizard.ts COMMON_ICE). */
export const ICE_LABEL: Record<IceKind, string> = {
  cubes: 'Cubes',
  large: 'Large cube',
  spear: 'Spear',
  crushed: 'Crushed',
  pebble: 'Pebble',
  shaved: 'Shaved',
  sphere: 'Sphere',
};

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

/** The venue's ice in the wizard's words, in its order ("Cubes", "Large cube"). */
export function venueIceNames(rows: readonly { kind: string; key: string }[]): string[] {
  return rows.filter((r) => r.kind === 'ice' && r.key in ICE_LABEL).map((r) => ICE_LABEL[r.key as IceKind]);
}

/** Whether a wizard pick is one of the venue's ice, by name ("large cube" is "Large cube"). */
export const isVenueIce = (names: readonly string[], name: string) => names.some((n) => n.toLowerCase() === name.trim().toLowerCase());

/** The venue's Kit row for an ice, by the wizard's name for it ("Spear"), or null. */
export const kitIceRow = <T extends { kind: string; key: string }>(rows: readonly T[], name: string): T | null =>
  rows.find((r) => r.kind === 'ice' && r.key in ICE_LABEL && isVenueIce([ICE_LABEL[r.key as IceKind]], name)) ?? null;

/** The prep kitchen's tools shown before "All tools": the ones bars reach for first. */
const PREP_FIRST = ['scale-fine', 'sous-vide', 'whipper', 'superbag', 'chamber-vac', 'centrifuge', 'rotovap'];

export interface ToolGroup {
  title: string;
  ids: string[];
}

/**
 * Behind the bar (every bar tool), then the prep kitchen: the common few plus
 * whatever the venue already has, or every tool when `all`.
 */
export function toolGroups(have: readonly string[], all: boolean): ToolGroup[] {
  const bar = EQUIPMENT.filter((e) => e.kind === 'bar').map((e) => e.id);
  const prep = EQUIPMENT.filter((e) => e.kind !== 'bar' && (all || PREP_FIRST.includes(e.id) || have.includes(e.id))).map((e) => e.id);
  return [
    { title: 'Behind the bar', ids: bar },
    { title: 'Prep kitchen', ids: prep },
  ];
}

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

/** Where a kit row comes from: "Made here · Hoshizaki under the well", "Coldwater Ice Co. · 130 mm", or just its note. */
export function kitSourceLine(row: { made_here: boolean; note: string | null; supplier_name: string | null; length_mm?: number | null }): string {
  return [row.made_here ? 'Made here' : row.supplier_name, row.note, row.length_mm ? `${row.length_mm} mm` : null].filter(Boolean).join(' · ');
}
