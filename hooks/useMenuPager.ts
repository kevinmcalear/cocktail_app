import { useMenuEditionDrinks, useMenuEditions } from '@/hooks/useMenuRuns';
import { useMenu } from '@/hooks/useMenus';
import { useProfile } from '@/hooks/useProfiles';
import { pagerPlace, type PagerDrink, type PagerPlace } from '@/lib/menuPager';

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
  // Only the drinks a guest can open (the same ones the guest menu lets them tap).
  const loaded = useMenuEditionDrinks(edition?.drinks ?? []);
  if (!menuId) return null;
  if (bar) {
    if (!edition || !loaded.data) return null;
    const readable = new Set(loaded.data.map((d) => d.id));
    // The guest page lists by section, each where its first drink sits (lib/menuEditions editionSections).
    const sections = [...new Set(edition.drinks.map((d) => d.section?.trim() || 'Cocktails'))];
    const drinks: PagerDrink[] = sections.flatMap((s) => edition.drinks.filter((d) => readable.has(d.id) && (d.section?.trim() || 'Cocktails') === s).map((d) => ({ id: d.id, name: d.name, kind: 'cocktail' })));
    return pagerPlace(edition.name, drinks, itemId);
  }
  const menu = team.data;
  if (!menu) return null;
  return pagerPlace(menu.name, menu.sections.flatMap((s) => s.drinks.map((d) => ({ id: d.id, name: d.name, kind: d.kind }))), itemId);
}
