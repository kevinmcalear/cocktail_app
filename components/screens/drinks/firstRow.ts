import { create } from 'zustand';

import type { SearchItem } from '@/types/search';

/**
 * The first row of Drinks' list beside the stack on a desktop (A to Z, before
 * any search), for /drinks to show beside it until a row is picked
 * (components/nav/NoDrinkPicked.tsx). The list is its only writer, so the
 * page and the lit row can't disagree. `ready` is false until the list has
 * loaded, so the page doesn't say "Pick a drink" while it does. Its own file,
 * so only the Drinks route's code carries it, not every page's first load.
 */
export const useDrinksFirstRow = create<{ item: SearchItem | null; ready: boolean }>(() => ({ item: null, ready: false }));
