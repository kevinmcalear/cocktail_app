import { useIsFocused, useRouter, type Href } from 'expo-router';
import { useEffect, useEffectEvent } from 'react';
import { Platform } from 'react-native';

import { useSignedIn } from '@/ctx/AuthContext';
import { useMenuEditionDrinks, useMenuEditions } from '@/hooks/useMenuRuns';
import { useMenu } from '@/hooks/useMenus';
import { useProfile } from '@/hooks/useProfiles';
import { drinkPageHref, itemHref } from '@/lib/itemRoutes';
import { inMenuQuery, pagerPlace, type PagerDrink, type PagerPlace } from '@/lib/menuPager';

const KIND = { cocktail: 'Cocktail', beer: 'Beer', wine: 'Wine' } as const;

/**
 * Where a drink sits on the menu it was opened from (Menu-pager): the menu the
 * team reads (/menus/[id], useMenu), or, with `bar`, the menu as a guest reads
 * it from the bar's page (get_menu_editions). Both are already cached by the
 * menu page that linked here, so paging costs no request. Null while loading,
 * or when the drink isn't on that menu.
 */
export function useMenuPager(menuId: string | null, bar: string | null, itemId: string): PagerPlace | null {
  const team = useMenu(bar ? null : menuId);
  const profile = useProfile(bar);
  const editions = useMenuEditions(bar ? profile.data?.id : null);
  const edition = bar ? editions.data?.find((e) => e.id === menuId) : undefined;
  // A guest pages only through the drinks they can open (the ones the guest menu lets them tap), counted among all it lists.
  const loaded = useMenuEditionDrinks(edition?.drinks ?? []);
  if (!menuId) return null;
  if (bar) {
    if (!edition || !loaded.data) return null;
    const readable = new Set(loaded.data.map((d) => d.id));
    // A beer or wine pages onto its own page: the kind comes from the drinks read (one a guest can't open isn't paged to).
    const kinds = new Map(loaded.data.map((d) => [d.id, d.kind]));
    // The guest page lists by section, each where its first drink sits (lib/menuEditions editionSections).
    const sections = [...new Set(edition.drinks.map((d) => d.section?.trim() || 'Cocktails'))];
    const drinks: PagerDrink[] = sections.flatMap((s) => edition.drinks.filter((d) => (d.section?.trim() || 'Cocktails') === s).map((d): PagerDrink => ({ id: d.id, name: d.name, kind: kinds.get(d.id) ?? 'cocktail' })));
    return pagerPlace(edition.name, drinks, itemId, (d) => readable.has(d.id));
  }
  const menu = team.data;
  if (!menu) return null;
  return pagerPlace(menu.name, menu.sections.flatMap((s) => s.drinks.map((d) => ({ id: d.id, name: d.name, kind: d.kind }))), itemId);
}

/**
 * The pager's place on the menu and a `go` that pages to a drink in it. Paging
 * replaces the page, so Back still returns to the menu.
 */
export function useMenuPagerNav(menuId: string, bar: string | null, itemId: string) {
  const router = useRouter();
  const signedIn = useSignedIn();
  const place = useMenuPager(menuId, bar, itemId);
  const go = (d: PagerDrink | null | undefined) => {
    if (!d) return;
    // A guest opens each drink as the guest menu's rows do (/d/<id> signed out); the team's beer or wine has its own page.
    const page = !bar && d.kind && d.kind !== 'cocktail' ? itemHref(KIND[d.kind as keyof typeof KIND], d.id) : drinkPageHref(d.id, signedIn);
    router.replace(`${page}?${inMenuQuery(menuId, bar)}` as Href);
  };
  return { place, go };
}

/**
 * The web's arrow keys page through a menu (the pager and the desktop pane):
 * only on the screen that's showing (stacked screens stay mounted on the web),
 * and not while someone is typing or a sheet or dialog is open.
 */
export function useMenuArrowKeys(onPrev: (() => void) | null, onNext: (() => void) | null) {
  const focused = useIsFocused();
  const onArrow = useEffectEvent((key: string) => (key === 'ArrowRight' ? onNext : key === 'ArrowLeft' ? onPrev : null)?.());
  useEffect(() => {
    if (Platform.OS !== 'web' || !focused) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))) return;
      if (document.querySelector('[role="dialog"], [aria-modal="true"]')) return;
      onArrow(e.key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focused]);
}
