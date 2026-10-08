import { useMemo, useState } from 'react';

import { useCurrentMenuDrinks } from '@/hooks/useCurrentMenuDrinks';
import { useVenueMenus } from '@/hooks/useMenus';
import { heroPicture, type ItemImageLink } from '@/lib/itemImages';
import { fallbackGlass, type ItemCategory } from '@/lib/itemRoutes';
import { groupMenus } from '@/lib/menus';

type Glass = { icon_key: string | null; name: string | null };

interface MenuItem {
  id: string;
  name: string;
  item_type: string;
  glass: Glass | Glass[] | null;
  item_images?: ItemImageLink[] | ItemImageLink | null;
}

export interface TonightDrink {
  id: string;
  name: string;
  category: ItemCategory;
  imageUrl: string | null;
  /** CustomIcons key for the drink's glass, for the no-image fallback. */
  glass: string;
  menuId: string;
}

const CATEGORY: Record<string, ItemCategory> = { cocktail: 'Cocktail', beer: 'Beer', wine: 'Wine' };

/**
 * What's pouring tonight at a venue: its menus on now (oldest first, the
 * running order) and their drinks. Reads the same menu list as Tonight's
 * menu cards, so it waits on nothing bigger.
 */
export function useTonight(venueId: string | null) {
  const { data: venueMenus, isLoading: menusLoading } = useVenueMenus(venueId);
  const [now] = useState(() => Date.now());
  const menus = useMemo(() => {
    const here = (venueMenus ?? []).filter((m) => !!venueId && m.barId === venueId);
    return groupMenus(here, now).on.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [venueMenus, venueId, now]);
  const { data: rows, isLoading: drinksLoading } = useCurrentMenuDrinks(menus.map((m) => m.id));

  const drinks = useMemo<TonightDrink[]>(() => {
    const out: TonightDrink[] = [];
    for (const row of rows ?? []) {
      const item = (Array.isArray(row.item) ? row.item[0] : row.item) as MenuItem | null;
      if (!item) continue;
      const category = CATEGORY[item.item_type] ?? 'Cocktail';
      const images = Array.isArray(item.item_images) ? item.item_images : item.item_images ? [item.item_images] : null;
      const glass = Array.isArray(item.glass) ? item.glass[0] : item.glass;
      out.push({
        id: item.id,
        name: item.name,
        category,
        imageUrl: heroPicture(images)?.url ?? null,
        glass: glass?.icon_key || glass?.name || fallbackGlass(category),
        menuId: row.menu_id,
      });
    }
    return out;
  }, [rows]);

  return { menus, drinks, isLoading: menusLoading || (menus.length > 0 && drinksLoading) };
}
