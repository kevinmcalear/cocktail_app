import { useMemo } from 'react';

import { useCocktails } from '@/hooks/useCocktails';
import { useCurrentMenuDrinks } from '@/hooks/useCurrentMenuDrinks';
import { useDropdowns } from '@/hooks/useDropdowns';
import { fallbackGlass, type ItemCategory } from '@/lib/itemRoutes';

interface MenuRow {
  id: string;
  name: string;
  bar_id: string | null;
  is_active: boolean;
}

interface NamedItem {
  id: string;
  name: string;
  icon_key?: string | null;
}

interface CocktailRow {
  id: string;
  glassware_id: string | null;
  item_images?: { images?: { url: string } | null }[] | null;
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

/** What's pouring tonight at a venue: its current menus and their drinks. */
export function useTonight(venueId: string | null) {
  const { data: dropdowns, isLoading: dropdownsLoading } = useDropdowns();
  const menus = useMemo(
    () => ((dropdowns?.menus ?? []) as MenuRow[]).filter((m) => m.is_active && !!venueId && m.bar_id === venueId),
    [dropdowns?.menus, venueId]
  );
  const { data: rows, isLoading: drinksLoading } = useCurrentMenuDrinks(menus.map((m) => m.id));
  const { data: cocktails } = useCocktails({ allContexts: true });

  const drinks = useMemo<TonightDrink[]>(() => {
    const glassIcon = new Map<string, string>();
    for (const g of (dropdowns?.glassware ?? []) as NamedItem[]) glassIcon.set(g.id, g.icon_key || g.name);
    const cocktailById = new Map<string, CocktailRow>();
    for (const c of (cocktails ?? []) as CocktailRow[]) cocktailById.set(c.id, c);

    const out: TonightDrink[] = [];
    for (const row of rows ?? []) {
      const item = Array.isArray(row.item) ? row.item[0] : row.item;
      if (!item) continue;
      const category = CATEGORY[item.item_type] ?? 'Cocktail';
      const cocktail = cocktailById.get(item.id);
      out.push({
        id: item.id,
        name: item.name,
        category,
        imageUrl: cocktail?.item_images?.[0]?.images?.url ?? null,
        glass: (cocktail?.glassware_id && glassIcon.get(cocktail.glassware_id)) || fallbackGlass(category),
        menuId: row.menu_id,
      });
    }
    return out;
  }, [rows, cocktails, dropdowns?.glassware]);

  return { menus, drinks, isLoading: dropdownsLoading || (menus.length > 0 && drinksLoading) };
}
