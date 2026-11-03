import { usePathname, useRouter, useSegments, type Href } from 'expo-router';
import { create } from 'zustand';

import { useWebNav } from '@/hooks/useIsWideWeb';
import { useMode } from '@/hooks/useMode';
import type { SearchItem } from '@/types/search';

/**
 * Drinks at a venue on a desktop (the sidebar, from 1200): the list stays on
 * the left and the picked drink opens beside it at its own URL
 * (/cocktail/<id>), the list beside the page the 2027 canvas draws from 1200.
 * The tablet (768 to 1199) keeps its own two panes (DrinksPanes, ?pick=);
 * phones never split. Home's Drinks is Collection, drawn as a full-width table.
 */
export function useDrinksSplit(): boolean {
  const nav = useWebNav();
  return useMode().mode !== 'home' && nav === 'sidebar';
}

/** A page on Drinks' stack while it sits beside the list: the drink there opens its editor as its own, full-width page. */
export function useBesideList(): boolean {
  const split = useDrinksSplit();
  const group = (useSegments() as string[])[1];
  return split && group === '(2-drinks)';
}

/** The drink a path opens on a tab's stack (/cocktail/<id>, not its edit or batch pages), or null. */
export function drinkInPane(pathname: string): string | null {
  return /^\/cocktail\/([^/?#]+)$/.exec(pathname)?.[1] ?? null;
}

/**
 * Opens a row from Drinks' list on a desktop. The first drink pushes beside
 * the list, so Back closes the pane; the next replaces it, so Back doesn't
 * walk through every drink looked at (and the web's stack doesn't keep each
 * one mounted). Anything else (a bottle, a beer) opens as its own page.
 */
export function useOpenBeside(): { picked: string | null; open: (href: string) => void } {
  const router = useRouter();
  const picked = drinkInPane(usePathname());
  const open = (href: string) => {
    const id = drinkInPane(href);
    if (id && id === picked) return;
    if (id && picked) router.replace(href as Href);
    else router.push(href as Href);
  };
  return { picked, open };
}

/**
 * The first row of Drinks' list beside the stack on a desktop, as the list
 * shows it (its view, its search), for /drinks to show beside it
 * (components/nav/NoDrinkPicked.tsx) until a row is picked. The list is its
 * only writer, so the page and the lit row can't disagree. `ready` is false
 * until the list has loaded, so the page doesn't say "Pick a drink" while it does.
 */
export const useDrinksFirstRow = create<{ item: SearchItem | null; ready: boolean }>(() => ({ item: null, ready: false }));
