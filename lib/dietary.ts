// Dietary, read from the spec (decision b52, 10 Oct 2026): a drink carries no
// vegan mark of its own. Names that come from animals, plus the eggs and milk
// the venue declared on what it buys, make it not vegan.
//
// ponytail: a word list, not a property of each ingredient. It catches what a
// bar spec says out loud (honey, egg white, cream, milk punch); it can't know
// a wine was fined with egg. Upgrade path: a vegan flag on ingredients, next to
// their allergens, once diet filters need it.

import type { Allergen } from './allergens';

/** A plant milk, cream or butter is vegan: "oat milk", "coconut cream", "cocoa butter". */
const PLANT = /\b(oat|almond|soy|soya|coconut|rice|cashew|plant|macadamia|pistachio|hazelnut|pea|hemp|cocoa|shea|peanut)[- ]+(milk|cream|butter)\b|\bcream of coconut\b/i;
const ANIMAL = /\b(honey|eggs?|egg ?whites?|egg ?yolks?|eggnog|cream|milk|butter|buttermilk|ghee|whey|cheese|yog(h)?urt|gelatine?|lard|bacon|anchov(y|ies)|oysters?|fish|bone|carmine|cochineal|beeswax|lanolin)\b/i;

/** The lines that come from animals, as named in the spec. */
export function animalLines(names: readonly string[]): string[] {
  return names.filter((n) => !/\bvegan\b/i.test(n) && ANIMAL.test(n.replace(PLANT, '')));
}

/** "honey", "egg white and cream", "egg white, cream and honey". */
function list(names: string[]): string {
  const low = names.map((n) => n.toLowerCase());
  return low.length < 2 ? (low[0] ?? '') : `${low.slice(0, -1).join(', ')} and ${low[low.length - 1]}`;
}

/** What makes a drink not vegan: the spec's animal lines, else the eggs or milk declared. Null when no names are known. */
function notVegan(names: readonly (string | null)[], allergens: readonly Allergen[]): { lines: string[]; declared: Allergen[] } | null {
  const known = names.filter((n): n is string => !!n);
  if (!known.length) return null;
  return { lines: animalLines(known).slice(0, 3), declared: allergens.filter((a) => a === 'eggs' || a === 'milk') };
}

/**
 * The Dietary notes line: "Contains honey, so not vegan." Null when
 * the names are hidden from this role (nothing to read it from).
 */
export function dietaryLine(names: readonly (string | null)[], allergens: readonly Allergen[] = []): string | null {
  const why = notVegan(names, allergens);
  if (!why) return null;
  if (why.lines.length) return `Contains ${list(why.lines)}, so not vegan.`;
  if (why.declared.length) return `Contains ${why.declared.join(' and ')}, so not vegan.`;
  return 'Nothing from animals in the spec, so vegan.';
}

/**
 * Vegan in the floor's allergy line (board Decided-who-floor: "No allergens ·
 * not vegan (honey)"): what makes it not vegan, by the word in the spec, or
 * "vegan". "Vegan" only when `sure` (every name read, every ingredient
 * checked): a server says it to a guest, so a guess says nothing. Null when
 * the names are hidden from this role.
 */
export function veganWord(names: readonly (string | null)[], allergens: readonly Allergen[] = [], sure = true): string | null {
  const why = notVegan(names, allergens);
  if (!why) return null;
  const words = [...new Set(why.lines.map((n) => ANIMAL.exec(n.replace(PLANT, ''))?.[0].toLowerCase() ?? n.toLowerCase()))];
  if (words.length) return `not vegan (${list(words)})`;
  if (why.declared.length) return `not vegan (${why.declared.join(' and ')})`;
  return sure && names.every(Boolean) ? 'vegan' : null;
}

/**
 * The floor's one allergy line: the allergens' first sentence with vegan on
 * it, the rest after ("Contains sulphites · vegan. 1 ingredient not checked
 * yet."). One sentence reads with no full stop, as the board draws it.
 */
export function withVegan(contains: string, vegan: string | null): string {
  if (!vegan) return contains;
  const cut = contains.indexOf('. ');
  const first = (cut < 0 ? contains : contains.slice(0, cut)).replace(/\.$/, '');
  return cut < 0 ? `${first} · ${vegan}` : `${first} · ${vegan}. ${contains.slice(cut + 2)}`;
}
