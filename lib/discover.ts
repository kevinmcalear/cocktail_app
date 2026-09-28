/**
 * Discover's "what" and "where": which drink lists to offer first, finding
 * one by name, and the cities that have public bars.
 */

// ponytail: a fixed "most asked for" order until rankings can say which lists
// people actually open. Upgrade path: order by rankers per list from the
// ranking refresh.
const MOST_ASKED = [
  'Martini',
  'Negroni',
  'Old Fashioned',
  'Margarita',
  'Espresso Martini',
  'Manhattan',
  'Daiquiri',
  'Paloma',
  'Whiskey Sour',
  'Mojito',
  'Aperol Spritz',
  'Penicillin',
  'Last Word',
  'Paper Plane',
  'Boulevardier',
  'Sazerac',
];

/** Lowercase, no accents, single spaces: "Café  Brûlot" matches "cafe brulot". */
export function foldName(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** The best-known drinks first, in MOST_ASKED order, then the rest A to Z. */
export function orderDrinks<T extends { name: string }>(drinks: readonly T[]): T[] {
  const rank = new Map(MOST_ASKED.map((n, i) => [foldName(n), i]));
  const at = (d: T) => rank.get(foldName(d.name)) ?? MOST_ASKED.length;
  return [...drinks].sort((a, b) => at(a) - at(b) || a.name.localeCompare(b.name));
}

/** Drinks whose name contains the search, names that start with it first. Order is otherwise kept. */
export function findDrinks<T extends { name: string }>(drinks: readonly T[], search: string): T[] {
  const q = foldName(search);
  if (!q) return [...drinks];
  const hits = drinks.filter((d) => foldName(d.name).includes(q));
  return [...hits.filter((d) => foldName(d.name).startsWith(q)), ...hits.filter((d) => !foldName(d.name).startsWith(q))];
}

export interface City {
  city: string;
  country_code: string;
  /** "Brooklyn", or "Brooklyn, US" when another country has one too. */
  label: string;
  /** Public bars there. */
  bars: number;
}

/** One entry per city with public bars, busiest first. Case and spacing differences count as the same city. */
export function citiesFrom(rows: readonly { city: string | null; country_code: string | null }[]): City[] {
  const byKey = new Map<string, City>();
  for (const r of rows) {
    const city = r.city?.trim();
    if (!city || !r.country_code) continue;
    const key = `${foldName(city)}|${r.country_code}`;
    const found = byKey.get(key);
    if (found) found.bars += 1;
    else byKey.set(key, { city, country_code: r.country_code, label: city, bars: 1 });
  }
  const cities = [...byKey.values()];
  const names = new Map<string, number>();
  for (const c of cities) names.set(foldName(c.city), (names.get(foldName(c.city)) ?? 0) + 1);
  for (const c of cities) if (names.get(foldName(c.city))! > 1) c.label = `${c.city}, ${c.country_code}`;
  return cities.sort((a, b) => b.bars - a.bars || a.label.localeCompare(b.label));
}
