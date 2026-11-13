import { createContext } from 'react';

/**
 * Room to keep free at the right end of an item page's top bar, for a button
 * drawn over the page from outside it: Drinks' "+ Add" on a desktop
 * (components/nav/NoDrinkPicked.tsx). The page's own … moves in by this much.
 * Its own file, so Drinks' first page doesn't load the drink page's bar with it.
 */
export const BarEndRoom = createContext(0);
