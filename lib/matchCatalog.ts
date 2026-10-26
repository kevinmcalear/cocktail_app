// The shared catalog the phone matches bottles against (hooks/useMatchCatalog):
// how it's split for downloading in parallel, and how it's saved between
// launches; and the server's shortlist of it for a snap (hooks/useServerMatch).
// Pure.

import { byName } from '@/lib/allRows';
import type { IngredientAlias } from '@/lib/ingredientNames';
import type { CatalogItem } from '@/lib/match';

/**
 * The id ranges the catalog downloads in, side by side: ids are random, so
 * each range holds about a sixteenth (~1,300 rows, two requests). `hi` is
 * where the next one starts, null for the last.
 */
export const CATALOG_RANGES: readonly { lo: string; hi: string | null }[] = [...'0123456789abcdef'].map((digit, i, all) => ({
  lo: `${digit}0000000-0000-0000-0000-000000000000`,
  hi: all[i + 1] ? `${all[i + 1]}0000000-0000-0000-0000-000000000000` : null,
}));

/** How long a saved catalog is used before it's downloaded again: new shared bottles reach a phone within a day. */
export const CATALOG_FRESH_MS = 24 * 60 * 60 * 1000;

/**
 * The shared catalog as saved: columns instead of objects, kinds as places in
 * the list (or the id, for a kind outside it), about half the size.
 */
export interface SavedCatalog {
  v: 1;
  savedAt: number;
  ids: string[];
  names: string[];
  kinds: (number | string | null)[];
}

export function packCatalog(items: readonly CatalogItem[], savedAt: number): SavedCatalog {
  const at = new Map(items.map((item, i) => [item.id, i]));
  return {
    v: 1,
    savedAt,
    ids: items.map((i) => i.id),
    names: items.map((i) => i.name),
    kinds: items.map((i) => (i.genericId ? (at.get(i.genericId) ?? i.genericId) : null)),
  };
}

/** The saved catalog's items (all shared), or null when it's missing, from another version, or broken. */
export function unpackCatalog(saved: unknown): { savedAt: number; items: CatalogItem[] } | null {
  const s = saved as Partial<SavedCatalog> | null;
  if (!s || s.v !== 1 || typeof s.savedAt !== 'number' || !Array.isArray(s.ids) || !Array.isArray(s.names) || !Array.isArray(s.kinds)) return null;
  const { ids, names, kinds } = s;
  if (names.length !== ids.length || kinds.length !== ids.length) return null;
  const items = ids.map((id, i): CatalogItem => {
    const kind = kinds[i];
    return { id, name: names[i], genericId: typeof kind === 'number' ? (ids[kind] ?? null) : kind, barId: null };
  });
  return { savedAt: s.savedAt, items };
}

/** A row of match_ingredients: a catalog row the matcher lands on for a reading, how many rows name it as their kind, and the alias that led to it. */
export interface ShortlistRow {
  id: string;
  name: string;
  generic_id: string | null;
  bar_id: string | null;
  kind_of: number;
  alias: string | null;
}

/**
 * The server's shortlist as the matcher's catalog and aliases: each row once,
 * shared first and then the venue's own, each by name, as useMatchCatalog
 * orders the whole catalog. In that order the matcher picks the same item
 * from the shortlist as from the whole catalog (it breaks ties by place).
 */
export function shortlistCatalog(rows: readonly ShortlistRow[]): { catalog: CatalogItem[]; aliases: IngredientAlias[] } {
  const items = new Map<string, CatalogItem>();
  const aliases = new Map<string, IngredientAlias>();
  for (const r of rows) {
    if (!items.has(r.id)) items.set(r.id, { id: r.id, name: r.name, genericId: r.generic_id, barId: r.bar_id, kindOf: r.kind_of });
    if (r.alias) aliases.set(r.alias, { key: r.alias, item_id: r.id });
  }
  const all = [...items.values()];
  return {
    catalog: [...all.filter((i) => !i.barId).sort(byName), ...all.filter((i) => i.barId).sort(byName)],
    aliases: [...aliases.values()],
  };
}
