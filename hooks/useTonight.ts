import { useMemo, useState } from 'react';

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
}

/** One menu that's on, with its sections in running order. */
export interface TonightBlock {
  menu: MenuSummary;
  sections: { id: string; name: string; drinks: TonightRow[] }[];
}

const CATEGORY: Record<string, ItemCategory> = { cocktail: 'Cocktail', beer: 'Beer', wine: 'Wine' };

/**
 * What's pouring tonight at a venue: its menus on now (oldest first, the
 * running order), each with its sections and their drinks. A drink is new
 * when no menu that has finished had it (and there is one to compare with). `drinks` is every drink, flat, for
 * the back bar and Study.
 */
export function useTonight(venueId: string | null) {
  const { data: venueMenus, isLoading: menusLoading } = useVenueMenus(venueId);
  const [now] = useState(() => Date.now());
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
              .map((d) => (Array.isArray(d.item) ? d.item[0] : d.item))
              .map((item) => (item ? toMenuDrink(item) : null))
              .filter((d): d is MenuDrink => !!d)
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
            const category = CATEGORY[d.kind] ?? 'Cocktail';
            return { id: d.id, name: d.name, category, imageUrl: d.imageUrl, glass: d.glass || fallbackGlass(category), menuId: b.menu.id };
          })
        )
      ),
    [blocks]
  );

  return { menus, blocks, drinks, isLoading: menusLoading || (menus.length > 0 && drinksLoading) };
}
