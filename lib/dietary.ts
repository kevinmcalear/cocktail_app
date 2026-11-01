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

/**
 * The Dietary notes line: "Contains honey, so not vegan." Null when
 * the names are hidden from this role (nothing to read it from).
 */
export function dietaryLine(names: readonly (string | null)[], allergens: readonly Allergen[] = []): string | null {
  const known = names.filter((n): n is string => !!n);
  if (!known.length) return null;
  const from = animalLines(known);
  if (from.length) return `Contains ${list(from.slice(0, 3))}, so not vegan.`;
  const declared = allergens.filter((a) => a === 'eggs' || a === 'milk');
  if (declared.length) return `Contains ${declared.join(' and ')}, so not vegan.`;
  return 'Nothing from animals in the spec, so vegan.';
}

/**
 * Vegan in the floor's allergy line (board Decided-who-floor: "No allergens ·
 * not vegan (honey)"): what makes it not vegan, by the word in the spec, or
 * "vegan". Null when the names are hidden from this role.
 */
export function veganWord(names: readonly (string | null)[], allergens: readonly Allergen[] = []): string | null {
  const known = names.filter((n): n is string => !!n);
  if (!known.length) return null;
  const words = [...new Set(animalLines(known).map((n) => ANIMAL.exec(n.replace(PLANT, ''))?.[0].toLowerCase() ?? n.toLowerCase()))];
  if (words.length) return `not vegan (${list(words.slice(0, 3))})`;
  const declared = allergens.filter((a) => a === 'eggs' || a === 'milk');
  if (declared.length) return `not vegan (${declared.join(' and ')})`;
  return 'vegan';
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
