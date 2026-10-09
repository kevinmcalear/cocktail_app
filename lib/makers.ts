// What a maker makes, in words for its page. The list matches the database's
// profiles_makes_known check (20261011152100_makers.sql).

export const MAKES = ['bottles', 'ice', 'garnish', 'glassware', 'barware', 'equipment'] as const;
export type Makes = (typeof MAKES)[number];

const WORD: Record<Makes, string> = {
  bottles: 'bottles',
  ice: 'ice',
  garnish: 'garnish',
  glassware: 'glassware',
  barware: 'barware',
  equipment: 'bar equipment',
};

/** "a, b and c". */
export function andList(words: readonly string[]): string {
  if (words.length < 2) return words[0] ?? '';
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

/** "Makes ice and glassware", or "Maker" when it hasn't said. Unknown values are skipped. */
export function makesLine(makes: readonly string[] | null | undefined): string {
  const words = MAKES.filter((m) => makes?.includes(m)).map((m) => WORD[m]);
  return words.length ? `Makes ${andList(words)}` : 'Maker';
}

/** "Delivers to New York and Jersey City", or null when it hasn't said. */
export function servesLine(serves: readonly string[] | null | undefined): string | null {
  const cities = (serves ?? []).map((c) => c.trim()).filter(Boolean);
  return cities.length ? `Delivers to ${andList(cities)}` : null;
}

/** Cities typed as "New York, Jersey City" (commas or new lines): trimmed, no repeats, at most 100 of up to 80 characters. */
export function parseCities(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[,\n]/)) {
    const city = raw.trim().replace(/\s+/g, ' ').slice(0, 80).trim();
    if (!city || seen.has(city.toLowerCase())) continue;
    seen.add(city.toLowerCase());
    out.push(city);
    if (out.length === 100) break;
  }
  return out;
}
