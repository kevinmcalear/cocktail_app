/**
 * Matching a bar's drink to the shared catalog classic it's a version of, so
 * "Martini (Ford)" is ranked with every other martini. These are only
 * suggestions: an editor confirms each link.
 */
import { distance } from './ingredientNames';

export interface Classic {
  id: string;
  name: string;
}

export interface ClassicMatch<C extends Classic = Classic> {
  classic: C;
  /** The names are the same once house notes and numbering are set aside. */
  exact: boolean;
}

// Spellings and other names seen on real menus, folded, to the catalog name, folded.
const ALIASES: Record<string, string> = {
  'a la louisiane': 'de la louisiane',
  boulvardier: 'boulevardier',
  'old fashion': 'old fashioned',
  pompiere: 'pompier',
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
    .trim()
    // "Corn 'n' Oil" is Corn and Oil.
    .replace(/(^| )n(?= |$)/g, '$1and');
}

/** The key without a trailing number: "daiquiri 4", "daiquiri no 5" → "daiquiri". */
function withoutNumber(key: string): string {
  return key.replace(/\s+(no\s+)?\d+$/, '').trim();
}

/** The key as old menus vary it: no "cocktail" on the end, no "No." before a number, no spaces ("Japanese Cocktail", "Green Point" → "japanese", "greenpoint"). */
function bareKey(key: string): string {
  return key.replace(/ cocktail$/, '').replace(/(^| )no (?=\d)/g, ' ').replace(/ /g, '');
}

const digits = (key: string) => key.replace(/\D/g, '');

/**
 * The classic a drink name most likely is: the same name (ignoring house
 * notes, numbering, a trailing "Cocktail", spacing and a few common
 * misspellings), or else the longest classic whose words appear in the name
 * ("Mega Negroni" → Negroni), or else one a letter or two off ("Caiprioska" →
 * Caipiroska). Only the first is exact; the others are guesses. Null when
 * nothing fits.
 */
export function suggestClassic<C extends Classic>(name: string, classics: readonly C[]): ClassicMatch<C> | null {
  const key = matchKey(name);
  if (!key) return null;
  const byKey = new Map(classics.map((c) => [matchKey(c.name), c]));
  const byBare = new Map<string, C>();
  for (const [k, c] of byKey) if (!byBare.has(bareKey(k))) byBare.set(bareKey(k), c);
  const tries = [key, ALIASES[key], withoutNumber(key), ALIASES[withoutNumber(key)]].filter((k): k is string => !!k);
  for (const k of tries) {
    const hit = byKey.get(k) ?? byBare.get(bareKey(k));
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
  if (best) return { classic: best, exact: false };
  // A slip of a letter (two in a long name), never the first letter or a different number: Frisco Sour isn't a Pisco Sour, nor Corpse Reviver #1 #2. Short names need it exact.
  const bare = bareKey(key);
  if (bare.length < 6) return null;
  const max = bare.length < 9 ? 1 : 2;
  let near: { classic: C; d: number } | null = null;
  for (const [k, c] of byKey) {
    if (k[0] !== key[0] || digits(k) !== digits(key)) continue;
    const d = distance(bareKey(k), bare, max);
    if (d <= max && (!near || d < near.d)) near = { classic: c, d };
  }
  return near ? { classic: near.classic, exact: false } : null;
}
