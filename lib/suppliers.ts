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
