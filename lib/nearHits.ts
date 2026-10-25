/**
 * "Did you mean", in every search (whole-app canvas, Search page): close
 * names from what the app holds (lib/nearName.ts) and from the database
 * (public.search_near), merged into one list, and what the results do with
 * it. Nothing found as typed asks about the closest (1B); something found
 * lists them last, "Spelled differently" (1C). A drink whose saved spelling
 * is exactly what was typed is a plain result, never asked about twice.
 * Pure; checked by lib/nearHits.check.ts.
 */
import type { SearchItem } from '@/types/search';

import { itemHref } from './itemRoutes';
import { itemIdOf } from './libraryFilters';
import { nearMatcher, nearReason } from './nearName';
import { searchItemHref } from './openSearchItem';

export type NearKind = 'drink' | 'bar' | 'person' | 'ingredient';

/** What a picker can ask public.search_near for: the search's kinds, and makers (20261113600000). */
export type PickKind = NearKind | 'maker';

/** A close name. Plain JSON. */
export interface NearHit {
  kind: NearKind;
  /** The row's id where it's shown (a search card's id for your own drinks). */
  id: string;
  name: string;
  /** Under the name: "Pale Moth · Collingwood", "Classic", "Yours". */
  caption: string | null;
  href: string;
  imageUrl: string | null;
  /** Lower is closer (near_score). */
  score: number;
  /** A saved spelling is exactly what was typed. */
  known: boolean;
  /** The drink "Yes, that's it" saves the spelling for; null for bars, people, ingredients and drafts. */
  spellingFor: string | null;
}

type Unscored = Omit<NearHit, 'score' | 'known'>;

/** A public.search_near row. */
export interface NearRow {
  kind: string;
  id: string;
  name: string;
  place: string | null;
  handle: string | null;
  score: number;
  known: boolean;
}

const KINDS: readonly string[] = ['drink', 'bar', 'person', 'ingredient'];

/** A database row as a hit; null for a kind this app doesn't know. */
export function fromRow(row: NearRow): NearHit | null {
  if (!KINDS.includes(row.kind)) return null;
  const kind = row.kind as NearKind;
  const page = `/p/${row.handle || row.id}`;
  return {
    kind,
    id: row.id,
    name: row.name,
    caption: row.place,
    href: kind === 'drink' ? itemHref('Cocktail', row.id) : kind === 'ingredient' ? itemHref('Ingredient', row.id) : page,
    imageUrl: null,
    score: row.score,
    known: row.known,
    spellingFor: kind === 'drink' ? row.id : null,
  };
}

/** One of your drinks or ingredients (or the venue's), as a close name; null for a menu. */
export function searchItemHit(item: SearchItem, caption: string | null): Unscored | null {
  const kind: NearKind | null = item.category === 'Ingredient' ? 'ingredient' : item.category === 'Menu' ? null : 'drink';
  if (!kind) return null;
  return {
    kind,
    id: item.id,
    name: item.name,
    caption: item.isDraft ? 'Draft' : caption,
    href: searchItemHref(item),
    imageUrl: item.image?.uri ?? null,
    spellingFor: kind === 'drink' && !item.isDraft ? itemIdOf(item.id) : null,
  };
}

/** A classic, as a close name. */
export function classicHit(c: { id: string; name: string; imageUrl?: string | null }): Unscored {
  return { kind: 'drink', id: c.id, name: c.name, caption: 'Classic', href: itemHref('Cocktail', c.id), imageUrl: c.imageUrl ?? null, spellingFor: c.id };
}

/** The close names in a list the app holds, as hits. */
export function nearIn<T>(query: string, rows: readonly T[], hit: (row: T) => Unscored | null): NearHit[] {
  const score = nearMatcher(query);
  const out: NearHit[] = [];
  for (const row of rows) {
    const h = hit(row);
    if (!h) continue;
    const s = score(h.name);
    if (s !== null) out.push({ ...h, score: s, known: false });
  }
  return out;
}

/**
 * One list: what's already on screen left out, each row once (the first
 * list wins), saved spellings first, then the closest, then the shortest name.
 */
export function mergeNear(lists: readonly (readonly NearHit[])[], shown: ReadonlySet<string>, limit = 8): NearHit[] {
  const seen = new Set(shown);
  const all: NearHit[] = [];
  for (const list of lists) {
    for (const h of list) {
      if (seen.has(h.id)) continue;
      seen.add(h.id);
      all.push(h);
    }
  }
  return all
    .sort((a, b) => Number(b.known) - Number(a.known) || a.score - b.score || a.name.length - b.name.length || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/**
 * Why a close row is here, after its place (canvas 1B, 1C): "sounds like
 * “salty boy”", "spelled close to “salty boy”", "starts like “salt”". Null
 * when its words are what was typed (a saved spelling).
 */
export function nearWhy(query: string, name: string): string | null {
  const q = query.trim();
  switch (nearReason(q, name)) {
    case 'sound':
      return `sounds like “${q}”`;
    case 'slip':
    case 'whole':
      return `spelled close to “${q}”`;
    case 'start':
      return `starts like “${q}”`;
    default:
      return null;
  }
}

export type NearView =
  /** Nothing close: the plain miss. */
  | { kind: 'none' }
  /** Nothing found as typed, but a saved spelling is: show those as results, the rest as "Also close". */
  | { kind: 'known'; known: NearHit[]; also: NearHit[] }
  /** Nothing found as typed: "Did you mean" the first, the rest "Also close" (1B). */
  | { kind: 'ask'; best: NearHit; also: NearHit[] }
  /** Found something: the close names last (1C). */
  | { kind: 'listed'; hits: NearHit[] };

export function nearView(found: number, hits: readonly NearHit[]): NearView {
  if (!hits.length) return { kind: 'none' };
  if (found > 0) return { kind: 'listed', hits: [...hits] };
  const known = hits.filter((h) => h.known);
  if (known.length) return { kind: 'known', known, also: hits.filter((h) => !h.known) };
  return { kind: 'ask', best: hits[0], also: hits.slice(1) };
}
