// What a supplier supplies, and the regions its lines name, in words for its
// page. SUPPLIES matches the database's profiles_supplies_known check, and a
// region is a country ("AU") or a state ("AU-VIC") as supplier_lines.region
// allows (20261017530100_suppliers.sql).

import { countryName } from './countries';
import { andList } from './makers';

export const SUPPLIES = ['bottles', 'ice', 'produce', 'garnish', 'glassware', 'barware', 'equipment'] as const;
export type Supplies = (typeof SUPPLIES)[number];

const WORD: Record<Supplies, string> = {
  bottles: 'bottles',
  ice: 'ice',
  produce: 'produce',
  garnish: 'garnish',
  glassware: 'glassware',
  barware: 'barware',
  equipment: 'bar equipment',
};

/** "Supplies bottles and glassware", or "Supplier" when it hasn't said. Unknown values are skipped. */
export function suppliesLine(supplies: readonly string[] | null | undefined): string {
  const words = SUPPLIES.filter((s) => supplies?.includes(s)).map((s) => WORD[s]);
  return words.length ? `Supplies ${andList(words)}` : 'Supplier';
}

// ponytail: only Australia's states and territories have names here, since the
// first suppliers are Australian. Another country's state shows its code until
// it's added (or until Hermes ships Intl.DisplayNames for subdivisions).
const STATES: Record<string, string> = {
  'AU-ACT': 'the ACT',
  'AU-NSW': 'New South Wales',
  'AU-NT': 'the Northern Territory',
  'AU-QLD': 'Queensland',
  'AU-SA': 'South Australia',
  'AU-TAS': 'Tasmania',
  'AU-VIC': 'Victoria',
  'AU-WA': 'Western Australia',
};

/** "In Victoria" for a state, "Across Australia" for a whole country. */
export function regionHeading(region: string): string {
  if (region.includes('-')) return `In ${STATES[region] ?? region}`;
  return `Across ${countryName(region)}`;
}

/** Lines grouped under their region's heading: states first by name, then whole countries. */
export function byRegion<T extends { region: string }>(lines: readonly T[]): { region: string; heading: string; lines: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const l of lines) groups.set(l.region, [...(groups.get(l.region) ?? []), l]);
  return [...groups.entries()]
    .map(([region, ls]) => ({ region, heading: regionHeading(region), lines: ls }))
    .sort((a, b) => Number(!a.region.includes('-')) - Number(!b.region.includes('-')) || a.heading.localeCompare(b.heading));
}

// State names a bar page may hold that differ from STATES' words.
const STATE_ALIASES: Record<string, string> = { 'australian capital territory': 'AU-ACT' };

/**
 * The supplier_lines regions that reach a venue: its state ("AU-VIC") and its
 * country ("AU"), from the bar page's country and region. A region is stored
 * as typed ("VIC" or "Victoria"), so both are read; one that can't be read
 * leaves the country alone.
 */
export function venueRegions(country: string | null | undefined, region: string | null | undefined): string[] {
  if (!country || !/^[A-Z]{2}$/.test(country)) return [];
  const r = (region ?? '').trim();
  const byName = STATE_ALIASES[r.toLowerCase()] ?? Object.entries(STATES).find(([code, name]) => code.startsWith(`${country}-`) && name.replace(/^the /, '').toLowerCase() === r.toLowerCase())?.[0];
  const byCode = /^[A-Za-z0-9]{1,3}$/.test(r) ? `${country}-${r.toUpperCase()}` : null;
  const state = byName ?? byCode;
  return state ? [state, country] : [country];
}

export interface SuggestedSupplier<P> {
  page: P;
  /** How many of the venue's bottles come from makers it carries there. */
  bottles: number;
}

/**
 * Supplier pages that carry the makers of a venue's bottles where it is, most
 * bottles first, leaving out the suppliers it already has.
 */
export function suggestSuppliers<P extends { id: string; display_name: string }>(
  bottles: readonly { itemId: string; makerId: string }[],
  lines: readonly { makerId: string; region: string; page: P }[],
  regions: readonly string[],
  have: ReadonlySet<string>
): SuggestedSupplier<P>[] {
  const pages = new Map<string, { page: P; makers: Set<string> }>();
  for (const l of lines) {
    if (!regions.includes(l.region) || have.has(l.page.id)) continue;
    const hit = pages.get(l.page.id) ?? { page: l.page, makers: new Set<string>() };
    hit.makers.add(l.makerId);
    pages.set(l.page.id, hit);
  }
  return [...pages.values()]
    .map(({ page, makers }) => ({ page, bottles: new Set(bottles.filter((b) => makers.has(b.makerId)).map((b) => b.itemId)).size }))
    .filter((s) => s.bottles > 0)
    .sort((a, b) => b.bottles - a.bottles || a.page.display_name.localeCompare(b.page.display_name));
}

/** An ingredient a venue uses or buys (hooks/useVenueIngredients.ts). */
export interface VenueIngredient {
  id: string;
  name: string;
  /** items.item_type: 'ingredient' for anything bought. */
  type: string;
  /** items.ingredient_role: 'prep' is made in house, not bought. */
  role: string | null;
  makerId: string | null;
  supplierId: string | null;
  /** In one of the venue's drinks or preps (not just bought). */
  used: boolean;
}

const WATER = /^(filtered |still |tap |cold |hot )?water$/i;

/** What the venue uses that it buys but has no supplier for, A to Z: not house preps, not water. */
export function withoutSupplier(ings: readonly VenueIngredient[]): VenueIngredient[] {
  return ings
    .filter((i) => i.used && !i.supplierId && i.type === 'ingredient' && i.role !== 'prep' && !WATER.test(i.name.trim()))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** A venue supplier as the pick under an ingredient line shows it. */
export interface SupplierChoice {
  id: string;
  name: string;
  /** "Brings your Calvados and 11 more · orders by Tue". */
  sub: string;
}

export interface SupplierPick {
  choices: SupplierChoice[];
  /** The first choice, when there's a reason for it. */
  suggested: string | null;
  /** "Cellar & Co brings your Calvados", for "Suggested because…". */
  why: string | null;
}

/**
 * The venue's suppliers to pick from for one bottle, the likeliest first: one
 * whose page lists the bottle's maker where the venue is (supplier_lines,
 * `carriers` are those pages' ids), then whoever brings most of the venue's
 * bottles of the same kind or maker, then the rest by how much they bring.
 * `where` is the venue's region heading ("In Victoria").
 */
export function pickSuppliers(
  bottle: { id: string; makerId: string | null; kindId: string | null },
  suppliers: readonly { id: string; name: string; order_by: string | null; items: number; pageId: string | null }[],
  bought: readonly { id: string; name: string; makerId: string | null; kindId: string | null; supplierId: string | null }[],
  carriers: ReadonlySet<string>,
  where: string | null
): SupplierPick {
  // The venue's other bottles like this one: the same kind (or this kind's own bottles), or the same maker.
  const like = bought.filter(
    (b) => b.id !== bottle.id && b.supplierId && ((bottle.kindId && b.kindId === bottle.kindId) || b.kindId === bottle.id || (bottle.makerId && b.makerId === bottle.makerId))
  );
  const likeFrom = (id: string) => like.filter((b) => b.supplierId === id);
  const lists = (s: { pageId: string | null }) => !!s.pageId && carriers.has(s.pageId);
  const ranked = [...suppliers].sort((a, b) => Number(lists(b)) - Number(lists(a)) || likeFrom(b.id).length - likeFrom(a.id).length || b.items - a.items || a.name.localeCompare(b.name));
  const top = ranked[0];
  const topLike = top ? likeFrom(top.id)[0] : null;
  const why = !top ? null : lists(top) ? `${top.name}’s page lists it ${where ? where.charAt(0).toLowerCase() + where.slice(1) : 'where you are'}` : topLike ? `${top.name} brings your ${topLike.name}` : null;
  return {
    choices: ranked.map((s) => {
      const mine = likeFrom(s.id)[0];
      const brings = mine ? (s.items > 1 ? `Brings your ${mine.name} and ${s.items - 1} more` : `Brings your ${mine.name}`) : s.items === 1 ? 'Brings one of your bottles' : s.items ? `Brings ${s.items} of your bottles` : 'Nothing of yours yet';
      return { id: s.id, name: s.name, sub: [brings, s.order_by?.trim() ? `orders by ${s.order_by.trim()}` : null].filter(Boolean).join(' · ') };
    }),
    suggested: why ? top.id : null,
    why,
  };
}

/**
 * Who sees a venue's buying parts while adding a drink: Costs sees suppliers
 * and prices, Prep sees suppliers only, and at home (no venue) neither.
 */
export function venueParts(barId: string | null, caps: readonly string[] | undefined): { canBuy: boolean; canCost: boolean } {
  const canCost = !!barId && !!caps?.includes('costs');
  return { canCost, canBuy: canCost || (!!barId && !!caps?.includes('prep')) };
}
