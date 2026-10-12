// What a reading already is in your bar, line by line: one matcher
// (lib/match.ts) for the Reading view's boxes and counts and for the checks.
// Pure.

import { isPrepName } from '@/lib/bringIn';
import type { IngredientAlias } from '@/lib/ingredientNames';
import { matchIngredient, type CatalogItem, type Match } from '@/lib/match';
import { pasteRows, type PasteRow } from '@/lib/paste';
import type { AnythingReading, ReadPlace } from '@/supabase/functions/_shared/anythingRead';
import type { MenuDrink } from '@/types/menus';

export interface MatchData {
  catalog: CatalogItem[];
  aliases: readonly IngredientAlias[];
  venueId: string | null;
  /** Drinks a menu's lines are matched to. */
  library: MenuDrink[];
  /** Bottles on your home shelf (item ids). */
  shelf: string[];
}

/** A menu line, matched, with where it's printed. */
export type MenuRow = PasteRow & { at: ReadPlace | null; printed: string | null; ingredients: string[] };

/** The menu's lines matched to your drinks. `picks`: row key → drink id. */
export function menuRows(reading: AnythingReading, library: MenuDrink[], picks: Record<string, string>): MenuRow[] {
  const sections = reading.menu?.sections ?? [];
  return pasteRows(sections, library, picks).map((row) => {
    const [si, li] = row.key.split(':').map(Number);
    const line = sections[si]?.lines[li];
    return { ...row, at: line?.at ?? null, printed: line?.price ?? null, ingredients: line?.ingredients ?? [] };
  });
}

export type IngredientState = { name: string; state: 'have'; item: CatalogItem } | { name: string; state: 'pick'; items: CatalogItem[] } | { name: string; state: 'new'; prep: boolean; kind: CatalogItem | null };

/** One ingredient named on a menu or in a spec, against the catalog. */
export function ingredientState(name: string, data: Pick<MatchData, 'catalog' | 'aliases' | 'venueId'>, pick?: string | null): IngredientState {
  const match: Match = matchIngredient(name, data.catalog, data.venueId, data.aliases);
  if (match.kind === 'one') return { name, state: 'have', item: match.item };
  if (match.kind === 'pick') {
    const chosen = match.items.find((item) => item.id === pick);
    return chosen ? { name, state: 'have', item: chosen } : { name, state: 'pick', items: match.items };
  }
  return { name, state: 'new', prep: isPrepName(name), kind: match.kindItem };
}

/**
 * The plain kind a pick falls back to when nobody picks ("Any pear
 * liqueur"): the kind every choice is a bottle of, else the kind the name is.
 */
export function plainKind(name: string, items: CatalogItem[], data: Pick<MatchData, 'catalog' | 'aliases' | 'venueId'>): CatalogItem | null {
  const generic = items[0]?.genericId;
  if (generic && items.every((i) => i.genericId === generic)) return data.catalog.find((c) => c.id === generic) ?? null;
  const none = matchIngredient({ name, kind: name }, data.catalog.filter((c) => !items.some((i) => i.id === c.id)), data.venueId, data.aliases);
  return none.kind === 'one' ? none.item : none.kind === 'none' ? none.kindItem : null;
}

export interface MatchSummary {
  have: number;
  total: number;
  newDrinks: number;
}

/** The Reading view's count: how much of it is already yours. */
export function matchSummary(reading: AnythingReading, data: MatchData): MatchSummary {
  if (reading.kind === 'menu') {
    const rows = menuRows(reading, data.library, {});
    return { have: rows.filter((r) => r.status === 'add').length, total: rows.length, newDrinks: rows.filter((r) => r.status === 'missing').length };
  }
  if (reading.kind === 'bottles') {
    const have = reading.bottles.filter((b) => {
      const m = matchIngredient(b, data.catalog, data.venueId, data.aliases);
      return m.kind === 'one' && (data.venueId ? m.item.barId === data.venueId : data.shelf.includes(m.item.id));
    }).length;
    return { have, total: reading.bottles.length + (reading.unreadable?.length ?? 0), newDrinks: 0 };
  }
  const lines = reading.recipes.flatMap((r) => r.lines);
  const have = lines.filter((l) => ingredientState(l.ingredient, data).state === 'have').length;
  return { have, total: lines.length, newDrinks: 0 };
}

/** The boxes to draw on page `page` while reading: solid where it's yours, dashed where it's new. */
export function pageMarks(reading: AnythingReading, data: MatchData, page: number): { box: ReadPlace['box']; dashed: boolean; label?: string }[] {
  const on = (at: ReadPlace | null | undefined): at is ReadPlace => !!at && at.page === page;
  if (reading.kind === 'menu') {
    return menuRows(reading, data.library, {}).flatMap((row) => (on(row.at) ? [{ box: row.at.box, dashed: row.status === 'missing' }] : []));
  }
  if (reading.kind === 'bottles') return [];
  return reading.recipes.flatMap((r) => r.lines.flatMap((l) => (on(l.at) ? [{ box: l.at.box, dashed: ingredientState(l.ingredient, data).state !== 'have' }] : [])));
}
