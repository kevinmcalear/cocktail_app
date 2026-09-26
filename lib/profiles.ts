/**
 * Pure helpers for public profiles (people and bars). Queries are in
 * hooks/useProfiles.ts; checked by lib/profiles.check.ts.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Same rule as the profiles.handle CHECK in the migration.
const HANDLE = /^[a-z0-9][a-z0-9._]{1,28}[a-z0-9]$/;

/**
 * A /p/<ref> link names a profile by id or by handle ("@juniper.jo" or
 * "juniper.jo"). Anything else is null, so it never reaches a query.
 */
export function parseProfileRef(ref: string | string[] | null | undefined): { id: string } | { handle: string } | null {
  const raw = (Array.isArray(ref) ? ref[0] : ref)?.trim();
  if (!raw) return null;
  if (UUID.test(raw)) return { id: raw.toLowerCase() };
  const handle = raw.replace(/^@/, '').toLowerCase();
  return HANDLE.test(handle) ? { handle } : null;
}

export interface MenuDrinkRow {
  item_id: string;
  menu: { id: string; name: string; is_active: boolean | null; bar_id: string | null; bar: { name: string } | null } | null;
}

export interface MenuCredit {
  menuId: string;
  menuName: string;
  barId: string | null;
  barName: string | null;
  /** On the bar's current menu, not a past one. */
  current: boolean;
  itemIds: string[];
}

/**
 * Menus that carry any of a profile's drinks, one entry per menu with its
 * drinks. Current menus first, then by bar and menu name.
 */
export function groupMenuCredits(rows: MenuDrinkRow[]): MenuCredit[] {
  const byMenu = new Map<string, MenuCredit>();
  for (const row of rows) {
    const menu = row.menu;
    if (!menu) continue;
    let credit = byMenu.get(menu.id);
    if (!credit) {
      credit = { menuId: menu.id, menuName: menu.name, barId: menu.bar_id, barName: menu.bar?.name ?? null, current: !!menu.is_active, itemIds: [] };
      byMenu.set(menu.id, credit);
    }
    if (!credit.itemIds.includes(row.item_id)) credit.itemIds.push(row.item_id);
  }
  return [...byMenu.values()].sort(
    (a, b) =>
      Number(b.current) - Number(a.current) ||
      (a.barName ?? '').localeCompare(b.barName ?? '') ||
      a.menuName.localeCompare(b.menuName)
  );
}

/** "Credited on 2 bar menus": the number of bars with a current menu carrying their drinks. */
export function barsCrediting(credits: MenuCredit[]): number {
  return new Set(credits.filter((c) => c.current && c.barId).map((c) => c.barId)).size;
}
