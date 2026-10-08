// One way to find what a name already is in the catalog. A pasted spec line,
// a drink on a photographed menu and a bottle on a shelf photo all match here,
// so the same bottle can't match in one place and not in another. Pure; the
// review screens render the result.
//
// ponytail: matches against what the app already has loaded. The upgrade is
// a trigram search in the database, or handing the reader a shortlist.

import { ingredientKey, type IngredientAlias } from '@/lib/ingredientNames';

export interface CatalogItem {
  id: string;
  name: string;
  genericId: string | null;
  barId: string | null;
}

/** What was read: a name, plus the brand and kind when a label showed them. */
export interface Reading {
  name: string;
  brand?: string | null;
  kind?: string | null;
}

export type Match<T = CatalogItem> =
  /** Sure enough to use without asking. */
  | { kind: 'one'; item: T }
  /** Close, but someone has to say which. Best first. */
  | { kind: 'pick'; items: T[] }
  /** Not there. `kindItem` is the plain kind it is ("London Dry Gin"), when there is one. */
  | { kind: 'none'; kindItem: CatalogItem | null };

const STOP = new Set(['the', 'and', 'de', 'di', 'del', 'la', 'le', 'of', 'aged']);
const MAX_CHOICES = 4;

/**
 * The database's ingredient key (public.ingredient_key) plus label spellings:
 * "Tanqueray Nº Ten" is "tanqueray no ten", "Hampden 8 Years Old" is "hampden 8yo".
 */
export function matchKey(value: string): string {
  return ingredientKey(value.replace(/n[º°]/gi, 'no ').replace(/(\d+)[\s-]*(?:years?|yrs?|yo)(?:[\s-]*old)?/gi, '$1yo'));
}

/** Drinks on a menu, kinds typed by hand: same name, or a pick between same-named ones. */
export function matchName<T extends { name: string }>(name: string, items: readonly T[]): Match<T> {
  const want = matchKey(name);
  const found = want ? items.filter((item) => matchKey(item.name) === want) : [];
  if (found.length === 1) return { kind: 'one', item: found[0] };
  if (found.length > 1) return { kind: 'pick', items: found };
  return { kind: 'none', kindItem: null };
}

function words(value: string | null | undefined): string[] {
  return value ? matchKey(value).split(' ').filter((w) => w && !STOP.has(w)) : [];
}

/**
 * One item per name: the venue's own, then the one other items name as their
 * kind (the catalog has a few exact repeats), then the first.
 */
function collapse(items: CatalogItem[], venueId: string | null, kinds: Set<string>): CatalogItem[] {
  const byKey = new Map<string, CatalogItem>();
  const rank = (i: CatalogItem) => (venueId && i.barId === venueId ? 2 : 0) + (kinds.has(i.id) ? 1 : 0);
  for (const item of items) {
    const key = matchKey(item.name);
    const have = byKey.get(key);
    if (!have || rank(item) > rank(have)) byKey.set(key, item);
  }
  return [...byKey.values()];
}

/**
 * What a reading already is. Only shared items and the venue's own count, in
 * this order: the same name (the venue's copy first), another name for one
 * ("1:1 sugar syrup" is Simple Syrup), a kind the venue keeps several bottles
 * of, then the label's words. A label candidate has to carry the brand, and
 * every word of its name has to be on the label (one may be missing from a
 * long name, but then someone picks).
 */
export function matchIngredient(
  reading: Reading | string,
  catalog: readonly CatalogItem[],
  venueId: string | null,
  aliases: readonly IngredientAlias[] = [],
): Match {
  const read: Reading = typeof reading === 'string' ? { name: reading } : reading;
  const pool = catalog.filter((i) => i.barId === null || (venueId !== null && i.barId === venueId));
  const kinds = new Set(pool.map((i) => i.genericId).filter((id): id is string => !!id));
  const key = matchKey(read.name);
  if (!key) return { kind: 'none', kindItem: null };

  const same = collapse(pool.filter((i) => matchKey(i.name) === key), venueId, kinds);
  if (same.length) return { kind: 'one', item: same[0] };

  const alias = aliases.find((a) => a.key === ingredientKey(read.name));
  const aliased = alias && pool.find((i) => i.id === alias.item_id);
  if (aliased) return { kind: 'one', item: aliased };

  // "Gin" where only the venue's bottles of gin are known: which bottle.
  const kindIds = new Set(catalog.filter((i) => matchKey(i.name) === key).map((i) => i.id));
  const bottles = pool.filter((i) => i.barId === venueId && i.genericId && kindIds.has(i.genericId));
  if (bottles.length) return { kind: 'pick', items: bottles };

  const brand = new Set(words(read.brand));
  if (brand.size) {
    const label = new Set([...brand, ...words(read.name), ...words(read.kind)]);
    const scored: { item: CatalogItem; score: number; missing: number }[] = [];
    for (const item of pool) {
      const own = words(item.name);
      if (!own.some((w) => brand.has(w))) continue;
      const missing = own.filter((w) => !label.has(w)).length;
      if (missing > 1 || (missing === 1 && own.length < 3)) continue;
      scored.push({ item, score: own.length - missing * 3, missing });
    }
    scored.sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));
    const top = scored[0];
    if (top) {
      const best = collapse(scored.filter((s) => s.score === top.score).map((s) => s.item), venueId, kinds);
      if (best.length === 1 && !top.missing) return { kind: 'one', item: best[0] };
      return { kind: 'pick', items: collapse(scored.map((s) => s.item), venueId, kinds).slice(0, MAX_CHOICES) };
    }
  }

  return { kind: 'none', kindItem: matchKind(read.kind, pool, venueId, kinds) ?? matchKind(read.name, pool, venueId, kinds) };
}

/** "London dry gin" → London Dry Gin, else the longest known name inside it (Gin). */
function matchKind(text: string | null | undefined, pool: CatalogItem[], venueId: string | null, kinds: Set<string>): CatalogItem | null {
  const want = new Set(words(text));
  if (!want.size) return null;
  const inside = pool
    .map((item) => ({ item, own: words(item.name) }))
    .filter(({ own }) => own.length && own.every((w) => want.has(w)) && own.join(' ').length >= 3)
    .sort((a, b) => b.own.length - a.own.length || Number(kinds.has(b.item.id)) - Number(kinds.has(a.item.id)));
  if (!inside.length) return null;
  return collapse(inside.filter((c) => c.own.length === inside[0].own.length).map((c) => c.item), venueId, kinds)[0];
}
