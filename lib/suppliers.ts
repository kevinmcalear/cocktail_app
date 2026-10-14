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
