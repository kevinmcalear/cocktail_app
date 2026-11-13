import { useMemo } from 'react';

import { useMenuNow } from '@/hooks/useMenuNow';
import { useCurrentMenuDrinks } from '@/hooks/useCurrentMenuDrinks';
import { toMenuDrink, useVenueMenus } from '@/hooks/useMenus';
import { fallbackGlass, type ItemCategory } from '@/lib/itemRoutes';
import { groupMenus, newDrinkIds } from '@/lib/menus';
import type { MenuDrink, MenuSummary } from '@/types/menus';

export interface TonightDrink {
  id: string;
  name: string;
  category: ItemCategory;
  imageUrl: string | null;
  /** CustomIcons key for the drink's glass, for the no-image fallback. */
  glass: string;
  menuId: string;
}

/** A drink on Tonight: as the menu shows it, and whether it's new on this menu. */
export interface TonightRow extends MenuDrink {
  isNew: boolean;
  /** A planned take-off (menu_drinks.off_at): Tonight says when it comes off. */
  offAt: string | null;
  /** The menu_drinks row, so a drink listed twice keeps distinct keys. Rows saved before it existed fall back to the drink's id. */
  rowId: string;
}

/** One menu that's on, with its sections in running order. */
export interface TonightBlock {
  menu: MenuSummary;
  sections: { id: string; name: string; drinks: TonightRow[] }[];
}

const CATEGORY: Record<string, ItemCategory> = { cocktail: 'Cocktail', beer: 'Beer', wine: 'Wine' };

/** A list drink's kind as a page category, for its link (itemHref). */
export const categoryOf = (kind: string): ItemCategory => CATEGORY[kind] ?? 'Cocktail';

/**
 * What's pouring tonight at a venue: its menus on now (oldest first, the
 * running order), each with its sections and their drinks. A drink is new
 * when no menu that has finished had it (and there is one to compare with). `drinks` is every drink, flat, for
 * the back bar and Study.
 */
export function useTonight(venueId: string | null) {
  const { data: venueMenus, isLoading: menusLoading, dataUpdatedAt: menusAt } = useVenueMenus(venueId);
  const now = useMenuNow(menusAt);
  const { menus, previous } = useMemo(() => {
    const groups = groupMenus((venueMenus ?? []).filter((m) => !!venueId && m.barId === venueId), now);
    return { menus: groups.on.sort((a, b) => a.createdAt.localeCompare(b.createdAt)), previous: groups.previous };
  }, [venueMenus, venueId, now]);
  const { data: rows, isLoading: drinksLoading } = useCurrentMenuDrinks(menus.map((m) => m.id));

  const blocks = useMemo<TonightBlock[]>(
    () =>
      menus.map((menu) => {
        // With no finished menu to compare against, nothing is marked new.
        const fresh = previous.length ? newDrinkIds(menu.itemIds, previous) : new Set<string>();
        const sections = (rows ?? [])
          .filter((s) => s.menu_id === menu.id)
          .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
          .map((s) => ({
            id: s.id,
            name: s.name,
            drinks: [...(s.menu_drinks ?? [])]
              .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
              .map((d) => {
                const item = Array.isArray(d.item) ? d.item[0] : d.item;
                return item ? { ...toMenuDrink(item, d.price ?? null), offAt: d.off_at ?? null, rowId: d.id ?? item.id } : null;
              })
              .filter((d): d is MenuDrink & { offAt: string | null; rowId: string } => !!d)
              .map((d) => ({ ...d, isNew: fresh.has(d.id) })),
          }))
          .filter((s) => s.drinks.length);
        return { menu, sections };
      }),
    [menus, previous, rows]
  );

  const drinks = useMemo<TonightDrink[]>(
    () =>
      blocks.flatMap((b) =>
        b.sections.flatMap((s) =>
          s.drinks.map((d) => {
            const category = categoryOf(d.kind);
            return { id: d.id, name: d.name, category, imageUrl: d.imageUrl, glass: d.glass || fallbackGlass(category), menuId: b.menu.id };
          })
        )
      ),
    [blocks]
  );

  return { menus, blocks, drinks, isLoading: menusLoading || (menus.length > 0 && drinksLoading) };
}
