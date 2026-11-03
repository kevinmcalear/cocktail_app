// A drink opened from a menu (2027 canvas, Menu-pager, Menu-in-draw): where it
// sits on that menu, "Autumn · 4 of 8", and the drinks either side of it.

export interface PagerDrink {
  id: string;
  name: string;
  /** cocktail, beer or wine: which page the next drink opens on. */
  kind?: string | null;
}

export interface PagerPlace {
  /** "Autumn · 4 of 8". */
  label: string;
  /** 0-based place on the menu. */
  index: number;
  total: number;
  prev: PagerDrink | null;
  next: PagerDrink | null;
}

/**
 * The drink's place on the menu, in the menu's own order (section by section,
 * as the page lists them). A drink listed twice takes its first place. Null
 * when the drink isn't on it (a stale link), so the page shows no pager.
 */
export function pagerPlace(menuName: string, drinks: readonly PagerDrink[], itemId: string): PagerPlace | null {
  // One stop per drink: a drink in two sections is still one page.
  const seen = new Set<string>();
  const order = drinks.filter((d) => (seen.has(d.id) ? false : (seen.add(d.id), true)));
  const index = order.findIndex((d) => d.id === itemId);
  if (index < 0 || order.length < 2) return null;
  return {
    label: `${menuName} · ${index + 1} of ${order.length}`,
    index,
    total: order.length,
    prev: order[index - 1] ?? null,
    next: order[index + 1] ?? null,
  };
}

/** The query a drink page carries while it is read in a menu: ?menu=<id>, plus the bar's page for a guest's menu. */
export function inMenuQuery(menuId: string, bar?: string | null): string {
  return `menu=${encodeURIComponent(menuId)}${bar ? `&bar=${encodeURIComponent(bar)}` : ''}`;
}
