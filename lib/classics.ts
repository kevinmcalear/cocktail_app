/**
 * Matching a bar's drink to the shared catalog classic it's a version of, so
 * "Martini (Ford)" is ranked with every other martini. These are only
 * suggestions: an editor confirms each link.
 */

export interface Classic {
  id: string;
  name: string;
}

export interface ClassicMatch<C extends Classic = Classic> {
  classic: C;
  /** The names are the same once house notes and numbering are set aside. */
  exact: boolean;
}

// Spellings seen on real menus, folded, to the catalog name, folded.
const ALIASES: Record<string, string> = {
  boulvardier: 'boulevardier',
  'old fashion': 'old fashioned',
  'tommy margarita': 'tommys margarita',
  'whisky sour': 'whiskey sour',
};

/** Lowercase words with no accents, punctuation or "(house notes)": "Vieux Carré (Ours)" → "vieux carre". */
export function matchKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** The key without a trailing number: "daiquiri 4", "daiquiri no 5" → "daiquiri". */
function withoutNumber(key: string): string {
  return key.replace(/\s+(no\s+)?\d+$/, '').trim();
}

/**
 * The classic a drink name most likely is: the same name (ignoring house
 * notes, numbering and a few common misspellings), or else the longest
 * classic whose words appear in the name ("Mega Negroni" → Negroni). Null
 * when nothing fits.
 */
export function suggestClassic<C extends Classic>(name: string, classics: readonly C[]): ClassicMatch<C> | null {
  const key = matchKey(name);
  if (!key) return null;
  const byKey = new Map(classics.map((c) => [matchKey(c.name), c]));
  for (const k of [key, ALIASES[key], withoutNumber(key), ALIASES[withoutNumber(key)]]) {
    const hit = k ? byKey.get(k) : undefined;
    if (hit) return { classic: hit, exact: true };
  }
  const padded = ` ${key} `;
  let best: C | null = null;
  let bestLength = 0;
  for (const [k, c] of byKey) {
    if (k.length > bestLength && padded.includes(` ${k} `)) {
      best = c;
      bestLength = k.length;
    }
  }
  return best ? { classic: best, exact: false } : null;
}
