// Finding a photographed bottle (supabase/functions/_shared/bottleRead.ts) in
// the ingredient catalog. Pure; the bottle photo sheet renders the result.
//
// ponytail: word overlap on the names the app already has loaded. Good for
// branded bottles whose catalog name is a subset of the label; the upgrade is
// a trigram search in the database, or handing the model a shortlist.

import type { CatalogItem } from '@/lib/paste';

export interface LabelReading {
  brand: string | null;
  name: string;
  kind: string | null;
}

export type BottleMatch =
  /** Sure enough to add without asking. */
  | { kind: 'one'; item: CatalogItem }
  /** Close, but someone has to say which. Best first. */
  | { kind: 'pick'; items: CatalogItem[] }
  /** Not in the catalog. `kindItem` is the plain kind ("London Dry Gin") when that is. */
  | { kind: 'none'; kindItem: CatalogItem | null };

const STOP = new Set(['the', 'and', 'de', 'di', 'del', 'la', 'le', 'of', 'aged']);
const MAX_CHOICES = 4;

/** "Código 1530 Añejo", "Hampden 8 Years Old", "No. Ten" → "codigo 1530 anejo", "hampden 8yo", "no ten". */
export function bottleKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/n[º°]/g, 'no ')
    .replace(/['’]/g, '')
    .replace(/(\d+)[\s-]*(?:years?|yrs?|yo)(?:[\s-]*old)?/g, '$1yo')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function words(value: string | null): string[] {
  return value ? bottleKey(value).split(' ').filter((w) => w && !STOP.has(w)) : [];
}

/**
 * One item per name: the venue's own, then the one other items name as their
 * kind (the catalog has a few exact repeats), then the first.
 */
function collapse(items: CatalogItem[], venueId: string | null, kinds: Set<string>): CatalogItem[] {
  const byKey = new Map<string, CatalogItem>();
  const rank = (i: CatalogItem) => (venueId && i.barId === venueId ? 2 : 0) + (kinds.has(i.id) ? 1 : 0);
  for (const item of items) {
    const key = bottleKey(item.name);
    const have = byKey.get(key);
    if (!have || rank(item) > rank(have)) byKey.set(key, item);
  }
  return [...byKey.values()];
}

/**
 * The catalog item a label names. Only shared items and the venue's own count.
 * A candidate has to carry the brand, and every word of its name has to be on
 * the label (one may be missing from a long name, but then someone picks).
 */
export function matchBottle(bottle: LabelReading, catalog: CatalogItem[], venueId: string | null): BottleMatch {
  const pool = catalog.filter((i) => i.barId === null || (venueId !== null && i.barId === venueId));
  const kinds = new Set(pool.map((i) => i.genericId).filter((id): id is string => !!id));

  const exactKey = bottleKey(bottle.name);
  const exact = collapse(pool.filter((i) => bottleKey(i.name) === exactKey), venueId, kinds);
  if (exact.length === 1) return { kind: 'one', item: exact[0] };

  const brand = new Set(words(bottle.brand));
  const label = new Set([...words(bottle.brand), ...words(bottle.name), ...words(bottle.kind)]);
  const scored: { item: CatalogItem; score: number; missing: number }[] = [];
  if (brand.size) {
    for (const item of pool) {
      const own = words(item.name);
      if (!own.some((w) => brand.has(w))) continue;
      const missing = own.filter((w) => !label.has(w)).length;
      if (missing > 1 || (missing === 1 && own.length < 3)) continue;
      scored.push({ item, score: own.length - missing * 3, missing });
    }
  }
  scored.sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));
  const top = scored[0];
  if (top) {
    const best = collapse(scored.filter((s) => s.score === top.score).map((s) => s.item), venueId, kinds);
    if (best.length === 1 && !top.missing) return { kind: 'one', item: best[0] };
    return { kind: 'pick', items: collapse(scored.map((s) => s.item), venueId, kinds).slice(0, MAX_CHOICES) };
  }

  return { kind: 'none', kindItem: matchKind(bottle.kind, pool, venueId, kinds) };
}

/** "London dry gin" → London Dry Gin, else the longest kind inside it (Gin). */
function matchKind(kind: string | null, pool: CatalogItem[], venueId: string | null, kinds: Set<string>): CatalogItem | null {
  const want = new Set(words(kind));
  if (!want.size) return null;
  const inside = pool
    .map((item) => ({ item, own: words(item.name) }))
    .filter(({ own }) => own.length && own.every((w) => want.has(w)))
    .sort((a, b) => b.own.length - a.own.length || Number(kinds.has(b.item.id)) - Number(kinds.has(a.item.id)));
  if (!inside.length) return null;
  return collapse(inside.filter((c) => c.own.length === inside[0].own.length).map((c) => c.item), venueId, kinds)[0];
}

/**
 * The kind a venue's own copy of a shared bottle points at: the bottle's kind,
 * or the bottle itself when it is a kind (Campari), so specs that call for the
 * shared one still find it on the shelf.
 */
export function kindForCopy(item: CatalogItem): string {
  return item.genericId ?? item.id;
}
