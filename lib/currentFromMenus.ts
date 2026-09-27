/** Current = menus.is_active. Cocktails on those menus are current by membership — no item flag. */

export type MenuCurrentRow = {
  id: string;
  name: string;
  bar_id?: string | null;
  is_active?: boolean | null;
};

export type MenuDrinkRow = {
  menu_id: string;
  sort_order?: number | null;
  item?: { id: string; name: string; item_type?: string | null } | null;
};

export function isCurrentMenu(menu: Pick<MenuCurrentRow, 'is_active'>) {
  return menu.is_active === true;
}

export function currentMenus<T extends MenuCurrentRow>(menus: T[]): T[] {
  return menus.filter(isCurrentMenu);
}

/** Unique cocktails on the given current menus, ordered by first appearance. */
export function currentCocktailsFromDrinks(
  drinks: MenuDrinkRow[],
  currentMenuIds: Set<string> | string[]
): { id: string; name: string; menu_id: string }[] {
  const ids = currentMenuIds instanceof Set ? currentMenuIds : new Set(currentMenuIds);
  const seen = new Set<string>();
  const out: { id: string; name: string; menu_id: string }[] = [];
  for (const row of drinks) {
    if (!ids.has(row.menu_id)) continue;
    const item = row.item;
    if (!item?.id || item.item_type !== 'cocktail') continue;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push({ id: item.id, name: item.name, menu_id: row.menu_id });
  }
  return out;
}

/** Menu drinks in running order: menus in the given order, then each menu's sort_order (unset last). */
export function inRunningOrder<T extends Pick<MenuDrinkRow, 'menu_id' | 'sort_order'>>(rows: T[], menuIds: string[]): T[] {
  const rank = (id: string) => {
    const i = menuIds.indexOf(id);
    return i < 0 ? menuIds.length : i;
  };
  const pos = (n: number | null | undefined) => n ?? Number.MAX_SAFE_INTEGER;
  return [...rows].sort((a, b) => rank(a.menu_id) - rank(b.menu_id) || pos(a.sort_order) - pos(b.sort_order));
}

/** Label for the set-current action: venue name or Personal. */
export function currentForLabel(barId: string | null | undefined, venueName?: string | null) {
  if (!barId) return 'Personal';
  return venueName?.trim() || 'Venue';
}
