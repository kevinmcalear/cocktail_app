// The ingredient catalog the pickers and the bottle matcher share
// (hooks/useIngredientCatalog): its columns, how it's split for downloading
// in parallel, and how it's saved between launches; and the server's
// shortlist of it for a snap (hooks/useServerMatch). Pure.

import { byName } from '@/lib/allRows';
import type { IngredientAlias } from '@/lib/ingredientNames';
import type { CatalogItem } from '@/lib/match';
import type { Row } from '@/types/db';

/** What a picker reads from an ingredient. Description too: home search matches it. */
export const CATALOG_COLUMNS = 'id, name, generic_id, bar_id, hide_from_search, ingredient_role, brand_maker, description';

/** An ingredient as the pickers and the matcher read it (CATALOG_COLUMNS). */
export type CatalogRow = Pick<Row<'app_item_presentation'>, 'name' | 'generic_id' | 'bar_id' | 'hide_from_search' | 'ingredient_role' | 'brand_maker' | 'description'> & {
  id: string;
};

/** As the matcher reads them: rows with a name, in the same order. */
export const toItems = (rows: readonly CatalogRow[]): CatalogItem[] =>
  rows.flatMap((r) => (r.name ? [{ id: r.id, name: r.name, genericId: r.generic_id, barId: r.bar_id }] : []));

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
 * the list (or the id, for a kind outside it), the hidden ones as places,
 * about half the size. Shared rows only, so no `bar_id`. v1 held names and
 * kinds only.
 */
export interface SavedCatalog {
  v: 2;
  savedAt: number;
  ids: string[];
  names: string[];
  kinds: (number | string | null)[];
  roles: (string | null)[];
  makers: (string | null)[];
  descriptions: (string | null)[];
  /** Places of the rows hidden from search. */
  hidden: number[];
}

export function packCatalog(rows: readonly CatalogRow[], savedAt: number): SavedCatalog {
  const at = new Map(rows.map((r, i) => [r.id, i]));
  return {
    v: 2,
    savedAt,
    ids: rows.map((r) => r.id),
    names: rows.map((r) => r.name),
    kinds: rows.map((r) => (r.generic_id ? (at.get(r.generic_id) ?? r.generic_id) : null)),
    roles: rows.map((r) => r.ingredient_role),
    makers: rows.map((r) => r.brand_maker),
    descriptions: rows.map((r) => r.description),
    hidden: rows.flatMap((r, i) => (r.hide_from_search ? [i] : [])),
  };
}

const COLUMNS = ['names', 'kinds', 'roles', 'makers', 'descriptions'] as const;

/** The saved catalog's rows (all shared), or null when it's missing, from another version, or broken. */
export function unpackCatalog(saved: unknown): { savedAt: number; rows: CatalogRow[] } | null {
  const s = saved as Partial<SavedCatalog> | null;
  if (!s || s.v !== 2 || typeof s.savedAt !== 'number' || !Array.isArray(s.ids) || !Array.isArray(s.hidden)) return null;
  if (COLUMNS.some((c) => !Array.isArray(s[c]) || s[c].length !== s.ids!.length)) return null;
  const { ids, names, kinds, roles, makers, descriptions } = s as SavedCatalog;
  const hidden = new Set(s.hidden);
  const rows = ids.map((id, i): CatalogRow => {
    const kind = kinds[i];
    return {
      id,
      name: names[i],
      generic_id: typeof kind === 'number' ? (ids[kind] ?? null) : kind,
      bar_id: null,
      hide_from_search: hidden.has(i),
      ingredient_role: roles[i],
      brand_maker: makers[i],
      description: descriptions[i],
    };
  });
  return { savedAt: s.savedAt, rows };
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
