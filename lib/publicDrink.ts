// Words on the signed-out drink page (/d/<id>): the kicker over the name, the
// credit under it, and the captions in its family tree and Where to drink it.
// Pure, so lib/publicDrink.check.ts can pin them down.

import { creditLabel, isRiff, type CreditStatus } from './lineage';
import { plural, rankCaption } from './ranking';

/** A public profile as the page names it. */
export interface PublicProfile {
  id: string;
  kind: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  locality: string | null;
  city: string | null;
}

/**
 * What kind of drink it is and when, over its name: "Modern classic · 2005",
 * "Pale Moth original · 2025", "Little Rye riff", "Little Rye version" (its
 * Americano). `origin` is the legacy
 * label (Classic, Modern Classic, Original, Varient).
 */
export function drinkKicker(
  d: {
    origin: string | null;
    originYear: number | null;
    riffOfId: string | null;
    name: string;
    /**
     * The drink it names, with its other names: the bar's own Americano is
     * its version, not a riff (dec-21). Undefined while it loads, so the
     * word doesn't change under the reader; null when it can't be read (a riff).
     */
    riffOf?: { name: string; aliases?: readonly string[] | null } | null;
  },
  barName: string | null,
): string {
  const label = d.origin?.trim().toLowerCase();
  if (d.riffOfId && d.riffOf === undefined && label !== 'classic' && label !== 'modern classic') return d.originYear ? String(d.originYear) : '';
  const version = !!d.riffOf && !isRiff(d, d.riffOf);
  const kind = label === 'classic' ? 'Classic' : label === 'modern classic' ? 'Modern classic' : d.riffOfId ? (barName ? `${barName} ${version ? 'version' : 'riff'}` : version ? 'Version' : 'Riff') : barName ? `${barName} original` : 'Original';
  return d.originYear ? `${kind} · ${d.originYear}` : kind;
}

/**
 * "Created by Sam Ross at Milk & Honey, New York · Verified". The bar's
 * neighbourhood (or else city) follows its name. Null with neither a maker
 * nor a bar.
 */
export function createdByLine(creator: Pick<PublicProfile, 'display_name'> | null, bar: { name: string; place?: string | null } | null, status: CreditStatus | null): string | null {
  if (!creator && !bar) return null;
  const where = bar ? `${bar.name}${bar.place ? `, ${bar.place}` : ''}` : null;
  const line = creator ? `Created by ${creator.display_name}${where ? ` at ${where}` : ''}` : `Created at ${where}`;
  const word = creditLabel(status);
  return word ? `${line} · ${word}` : line;
}

/** Who a riff in the family tree is by: a person by @handle, a bar by name. */
export function makerLabel(p: Pick<PublicProfile, 'kind' | 'handle' | 'display_name'> | null): string | null {
  if (!p) return null;
  return p.kind === 'person' ? `@${p.handle}` : p.display_name;
}

/** One ingredient's name on a public page, and whether it's a product's (public_drink_ingredients). */
export interface IngredientName {
  name: string;
  brand: boolean;
}

// ponytail: the place and proper words a generic's name keeps capitalised ("Islay Scotch"); grow it as names need, or store a reading name per ingredient.
const PROPER = new Set(['scotch', 'islay', 'irish', 'japanese', 'jamaican', 'mexican', 'french', 'italian', 'thai', 'london', 'earl', 'grey', 'campari', 'chartreuse']);

/** A generic's name as it reads mid-sentence: "Sweet Vermouth" is "sweet vermouth", "Islay Scotch" stays. */
function midSentence(name: string): string {
  return name
    .split(' ')
    .map((w) => (PROPER.has(w.toLowerCase()) ? w : w.toLowerCase()))
    .join(' ');
}

/**
 * "Gin, Green Chartreuse, maraschino, lime": a drink's ingredient names as one
 * line, each once, in spec order. A product keeps its capitals, a generic
 * reads in lower case (ppl-pub-menu-phone). Null with none.
 */
export function ingredientsLine(names: readonly IngredientName[]): string | null {
  const once = names.filter((n, i) => n.name && names.findIndex((o) => o.name === n.name) === i);
  return once.length ? once.map((n, i) => (i && !n.brand ? midSentence(n.name) : n.name)).join(', ') : null;
}

/** An ancestor's line under its name in the tree: "Classic", or "Milk & Honey, 2000s"-style maker and year. */
export function ancestorCaption(d: { origin: string | null; originYear: number | null }, maker: string | null): string | null {
  const label = d.origin?.trim().toLowerCase();
  if (label === 'classic') return 'Classic';
  if (label === 'modern classic') return d.originYear ? `Modern classic, ${d.originYear}` : 'Modern classic';
  return [maker, d.originYear ? String(d.originYear) : null].filter(Boolean).join(', ') || null;
}

/** One bar's row in an area list, as get_drink_rankings returns it. */
export interface WhereRow {
  venue_profile_id: string;
  score: number;
  rankers: number;
}

/**
 * The line over Where to drink it: where this drink's bar stands ("#1 of 11
 * Penicillins near Melbourne · 437 ranked"), or, for a drink with no bar in
 * the list, how many bars pour it. `rankers` is everyone in the list.
 */
export function whereCaption(rows: readonly WhereRow[], name: string, city: string | null, ownBarProfileId: string | null): string | null {
  if (!rows.length) return null;
  const where = city ? `near ${city}` : undefined;
  const rankers = rows.reduce((n, r) => n + r.rankers, 0);
  const own = ownBarProfileId ? rows.findIndex((r) => r.venue_profile_id === ownBarProfileId) : -1;
  if (own >= 0)
    return rankCaption({
      position: own + 1,
      of: rows.length,
      name,
      where,
      rankers,
    });
  const place = [`${rows.length} ${rows.length === 1 ? name.trim() : plural(name)}`, where].filter(Boolean).join(' ');
  return `${place} · ${rankers} ranked`;
}
