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
  'astoria hotel special': 'astor hotel special',
  boulvardier: 'boulevardier',
  'coo wee': 'coo ee special',
  'old fashion': 'old fashioned',
  'pan am clipper': 'pan american clipper',
  pompiere: 'pompier',
  'tommy margarita': 'tommys margarita',
  'turf club': 'turf',
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

/** The key as old menus space it: no "No." before a number, no spaces ("Green Point", "Corpse Reviver No. 2" → "greenpoint", "corpsereviver2"). */
function squashKey(key: string): string {
  return key.replace(/(^| )no (?=\d)/g, ' ').replace(/ /g, '');
}

const noCocktail = (key: string) => key.replace(/ cocktail$/, '');
const digits = (key: string) => key.replace(/\D/g, '');

interface Index<C> {
  byKey: Map<string, C>;
  bySquash: Map<string, C>;
  /** Classics whose name ends in "Cocktail", by the rest ("japanese" → Japanese Cocktail). */
  byShort: Map<string, C>;
}

// One index per catalog list: Match to classics asks for every drink, the wizard on every keystroke.
const indexes = new WeakMap<readonly Classic[], Index<Classic>>();

function indexOf<C extends Classic>(classics: readonly C[]): Index<C> {
  const known = indexes.get(classics) as Index<C> | undefined;
  if (known) return known;
  const byKey = new Map(classics.map((c) => [matchKey(c.name), c]));
  const bySquash = new Map<string, C>();
  const byShort = new Map<string, C>();
  for (const [k, c] of byKey) {
    if (!bySquash.has(squashKey(k))) bySquash.set(squashKey(k), c);
    const short = squashKey(noCocktail(k));
    if (noCocktail(k) !== k && !byShort.has(short)) byShort.set(short, c);
  }
  const index = { byKey, bySquash, byShort };
  indexes.set(classics, index as Index<Classic>);
  return index;
}

/**
 * The classic a drink name most likely is: the same name (ignoring house
 * notes, numbering, spacing, a "Cocktail" the menu added and a few common
 * misspellings), or else a guess: the classic with "Cocktail" on the end
 * ("Japanese" → Japanese Cocktail, but a bare "Champagne" may be the wine),
 * the longest classic whose words appear in the name ("Mega Negroni" →
 * Negroni), or one a letter or two off ("Caiprioska" → Caipiroska). Null when
 * nothing fits.
 */
export function suggestClassic<C extends Classic>(name: string, classics: readonly C[]): ClassicMatch<C> | null {
  const key = matchKey(name);
  if (!key) return null;
  const { byKey, bySquash, byShort } = indexOf(classics);
  const tries = [key, ALIASES[key], withoutNumber(key), ALIASES[withoutNumber(key)]].filter((k): k is string => !!k);
  for (const k of tries) {
    const hit = byKey.get(k) ?? bySquash.get(squashKey(k)) ?? bySquash.get(squashKey(noCocktail(k)));
    if (hit) return { classic: hit, exact: true };
  }
  for (const k of tries) {
    const hit = byShort.get(squashKey(k));
    if (hit) return { classic: hit, exact: false };
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
  const bare = squashKey(noCocktail(key));
  if (bare.length < 6) return null;
  const max = bare.length < 9 ? 1 : 2;
  let near: { classic: C; d: number } | null = null;
  for (const [k, c] of byKey) {
    if (k[0] !== key[0] || digits(k) !== digits(key)) continue;
    const d = distance(squashKey(noCocktail(k)), bare, max);
    if (d <= max && (!near || d < near.d)) near = { classic: c, d };
  }
  return near ? { classic: near.classic, exact: false } : null;
}
