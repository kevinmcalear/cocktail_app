import type { QueryClient } from '@tanstack/react-query';

import type { Row } from '@/types/db';

/**
 * A drink's own flags from items, read once with the drink page
 * (cocktailQuery in hooks/useCocktails.ts) so its approval notice and spec
 * levels don't each ask for the same row again (prod check, 1 Nov 2026: about
 * 35 requests a drink page).
 */
export type ItemFlags = Pick<Row<'items'>, 'parts' | 'spec_hidden' | 'awaiting_approval' | 'created_by' | 'bar_id'>;
export const ITEM_FLAG_COLUMNS = 'parts, spec_hidden, awaiting_approval, created_by, bar_id';

const key = (id: string) => ['item-flags', id] as const;
/** How old a copy may be and still stand in for a read: the page's own load, not a later visit. */
const FRESH_MS = 30_000;

export function keepItemFlags(client: QueryClient, id: string, flags: ItemFlags | null) {
  client.setQueryData(key(id), flags);
}

/** The flags the drink page just read, or undefined when there's no recent copy (read them yourself). */
export function recentItemFlags(client: QueryClient, id: string): ItemFlags | null | undefined {
  const state = client.getQueryState<ItemFlags | null>(key(id));
  return state && Date.now() - state.dataUpdatedAt < FRESH_MS ? state.data : undefined;
}

/** After a write to one of them, so the next read asks the server. */
export function forgetItemFlags(client: QueryClient, id: string) {
  client.removeQueries({ queryKey: key(id), exact: true });
}
