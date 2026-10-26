// One way to find what a name already is in the catalog. A pasted spec line,
// a drink on a photographed menu and a bottle on a shelf photo all match here,
// so the same bottle can't match in one place and not in another. Pure; the
// review screens render the result.
//
// The catalog is the whole one (keyed once, catalogIndex) or, for a snap, the
// server's shortlist of it (match_ingredients, hooks/useServerMatch): the
// rows this matcher can land on, with how many rows name each as their kind.

import { ingredientKey, type IngredientAlias } from '@/lib/ingredientNames';

export interface CatalogItem {
  id: string;
  name: string;
  genericId: string | null;
  barId: string | null;
  /** How many rows in the pool name this one as their kind, when the catalog is a shortlist that doesn't hold them. */
  kindOf?: number;
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
  return value ? keyWords(matchKey(value)) : [];
}

const keyWords = (key: string) => key.split(' ').filter((w) => w && !STOP.has(w));

/** A catalog item with its key and words worked out once. `at`: its place in the catalog. */
interface Entry {
  item: CatalogItem;
  key: string;
  words: string[];
  at: number;
}

/** The catalog, keyed once (lookups by key, word, id and kind), so a match doesn't re-key every item. */
export interface CatalogIndex {
  byKey: Map<string, Entry[]>;
  byWord: Map<string, Entry[]>;
  byId: Map<string, CatalogItem>;
  byKind: Map<string, Entry[]>;
  /** The kinds items in each venue's pool (null: shared only) name, made when first asked for. */
  kinds: Map<string | null, Set<string>>;
}

const indexes = new WeakMap<readonly CatalogItem[], CatalogIndex>();

const push = <K, V>(map: Map<K, V[]>, key: K, value: V) => {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
};

/** The catalog's index, made the first time a catalog list is matched against and kept while the list is. */
export function catalogIndex(catalog: readonly CatalogItem[]): CatalogIndex {
  let index = indexes.get(catalog);
  if (index) return index;
  index = { byKey: new Map(), byWord: new Map(), byId: new Map(), byKind: new Map(), kinds: new Map() };
  for (let at = 0; at < catalog.length; at++) {
    const item = catalog[at];
    const key = matchKey(item.name);
    const entry: Entry = { item, key, words: keyWords(key), at };
    push(index.byKey, key, entry);
    for (const w of new Set(entry.words)) push(index.byWord, w, entry);
    if (!index.byId.has(item.id)) index.byId.set(item.id, item);
    if (item.genericId) push(index.byKind, item.genericId, entry);
  }
  indexes.set(catalog, index);
  return index;
}

const inPool = (item: CatalogItem, venueId: string | null) => item.barId === null || (venueId !== null && item.barId === venueId);

function poolKinds(index: CatalogIndex, catalog: readonly CatalogItem[], venueId: string | null): Set<string> {
  let kinds = index.kinds.get(venueId);
  if (!kinds) {
    kinds = new Set(catalog.filter((i) => i.genericId && inPool(i, venueId)).map((i) => i.genericId!));
    for (const i of catalog) if (i.kindOf) kinds.add(i.id);
    index.kinds.set(venueId, kinds);
  }
  return kinds;
}

/** The entries under any of `keys`, each once, in catalog order. */
function under(map: Map<string, Entry[]>, keys: Iterable<string>, keep: (e: Entry) => boolean): Entry[] {
  const seen = new Set<Entry>();
  for (const k of keys) for (const e of map.get(k) ?? []) if (keep(e)) seen.add(e);
  return [...seen].sort((a, b) => a.at - b.at);
}

/**
 * One item per name: the venue's own, then the one other items name as their
 * kind (the catalog has a few exact repeats), then the first.
 */
function collapse(entries: Entry[], venueId: string | null, kinds: Set<string>): CatalogItem[] {
  const byKey = new Map<string, CatalogItem>();
  const rank = (i: CatalogItem) => (venueId && i.barId === venueId ? 2 : 0) + (kinds.has(i.id) ? 1 : 0);
  for (const { item, key } of entries) {
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
 * long name, but then someone picks). `without`: item ids to leave out, as if
 * they weren't in the catalog.
 */
export function matchIngredient(
  reading: Reading | string,
  catalog: readonly CatalogItem[],
  venueId: string | null,
  aliases: readonly IngredientAlias[] = [],
  without?: ReadonlySet<string>,
): Match {
  const read: Reading = typeof reading === 'string' ? { name: reading } : reading;
  const index = catalogIndex(catalog);
  const there = (e: Entry) => !without?.has(e.item.id);
  const pooled = (e: Entry) => inPool(e.item, venueId) && there(e);
  let kinds = poolKinds(index, catalog, venueId);
  if (without?.size) {
    // A kind only a left-out item named is no longer one (a shortlist counts the ones it doesn't hold).
    kinds = new Set(kinds);
    for (const id of without) {
      const kind = index.byId.get(id)?.genericId;
      if (!kind || (index.byKind.get(kind) ?? []).some(pooled)) continue;
      const out = [...without].filter((w) => {
        const item = index.byId.get(w);
        return item?.genericId === kind && inPool(item, venueId);
      }).length;
      if ((index.byId.get(kind)?.kindOf ?? 0) - out <= 0) kinds.delete(kind);
    }
  }
  const key = matchKey(read.name);
  if (!key) return { kind: 'none', kindItem: null };

  const same = collapse((index.byKey.get(key) ?? []).filter(pooled), venueId, kinds);
  if (same.length) return { kind: 'one', item: same[0] };

  const alias = aliases.find((a) => a.key === ingredientKey(read.name));
  const aliased = alias && !without?.has(alias.item_id) ? index.byId.get(alias.item_id) : undefined;
  if (aliased && inPool(aliased, venueId)) return { kind: 'one', item: aliased };

  // "Gin" where only the venue's bottles of gin are known: which bottle.
  const kindIds = (index.byKey.get(key) ?? []).filter(there).map((e) => e.item.id);
  const bottles = under(index.byKind, kindIds, (e) => e.item.barId === venueId && pooled(e)).map((e) => e.item);
  if (bottles.length) return { kind: 'pick', items: bottles };

  const brand = new Set(words(read.brand));
  if (brand.size) {
    const label = new Set([...brand, ...words(read.name), ...words(read.kind)]);
    const scored: { entry: Entry; score: number; missing: number }[] = [];
    for (const entry of under(index.byWord, brand, pooled)) {
      const own = entry.words;
      const missing = own.filter((w) => !label.has(w)).length;
      if (missing > 1 || (missing === 1 && own.length < 3)) continue;
      scored.push({ entry, score: own.length - missing * 3, missing });
    }
    scored.sort((a, b) => b.score - a.score || a.entry.item.name.localeCompare(b.entry.item.name));
    const top = scored[0];
    if (top) {
      const best = collapse(scored.filter((s) => s.score === top.score).map((s) => s.entry), venueId, kinds);
      if (best.length === 1 && !top.missing) return { kind: 'one', item: best[0] };
      return { kind: 'pick', items: collapse(scored.map((s) => s.entry), venueId, kinds).slice(0, MAX_CHOICES) };
    }
  }

  return { kind: 'none', kindItem: matchKind(read.kind, index, pooled, venueId, kinds) ?? matchKind(read.name, index, pooled, venueId, kinds) };
}

/** "London dry gin" → London Dry Gin, else the longest known name inside it (Gin). */
function matchKind(text: string | null | undefined, index: CatalogIndex, pooled: (e: Entry) => boolean, venueId: string | null, kinds: Set<string>): CatalogItem | null {
  const want = new Set(words(text));
  if (!want.size) return null;
  const inside = under(index.byWord, want, (e) => pooled(e) && e.words.every((w) => want.has(w)) && e.words.join(' ').length >= 3).sort(
    (a, b) => b.words.length - a.words.length || Number(kinds.has(b.item.id)) - Number(kinds.has(a.item.id))
  );
  if (!inside.length) return null;
  return collapse(inside.filter((e) => e.words.length === inside[0].words.length), venueId, kinds)[0];
}
