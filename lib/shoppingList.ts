/**
 * The shopping list (design B, canvas 8w6AQdWxjj9UHacXufv89J): where each
 * thing is bought, why it's on the list, how the list groups, and the text
 * Share sends. Pure helpers (lib/shoppingList.check.ts).
 */
import type { BarSection } from '@/lib/barSections';
import { PANTRY } from '@/lib/pantry';
import type { AwayGroup } from '@/lib/toMake';

export type ShoppingSource = 'hand' | 'drink' | 'menu' | 'one_away' | 'running_low' | 'again';

export interface ShoppingRow {
  id: string;
  /** The catalog or house ingredient; null for something typed ("Limes"). */
  itemId: string | null;
  name: string;
  source: ShoppingSource;
  /** The drink it was added for, by name. */
  forName: string | null;
  section: BarSection;
  imageUrl: string | null;
  gotAt: string | null;
}

/** Where you buy it, from its My Bar section. */
export function shopFor(section: BarSection): string {
  if (section === 'bottles') return 'Bottle shop';
  if (section === 'lab') return 'Online or a cook’s shop';
  if (section === 'preps') return 'House-made';
  return 'Grocer';
}
const SHOP_ORDER = ['Bottle shop', 'Grocer', 'Online or a cook’s shop', 'House-made'];

/** The drinks one bottle opens on its own: its One away group. */
export function opensWith(itemId: string | null, oneAway: readonly AwayGroup[]): { id: string; name?: string }[] {
  if (!itemId) return [];
  const group = oneAway.find((g) => g.bottles.length === 1 && g.bottles[0].id === itemId);
  return group ? [...group.drinks] : [];
}

/** "Boulevardier, Fanciulli +2". */
export function drinkNames(drinks: readonly { name?: string }[]): string {
  const names = drinks.flatMap((d) => (d.name ? [d.name] : []));
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ');
}

/** Why it's on the list: "Running low", "For Smoke Signal", "Opens 4 drinks: Boulevardier, Fanciulli +2", "Added by you". */
export function whyLine(row: Pick<ShoppingRow, 'source' | 'forName'>, opens: readonly { name?: string }[]): string {
  if (row.source === 'running_low') return 'Running low';
  if (row.forName) return `For ${row.forName}`;
  if (opens.length > 1) return `Opens ${opens.length} drinks: ${drinkNames(opens)}`;
  if (opens.length === 1 && opens[0].name) return `For ${opens[0].name}`;
  if (row.source === 'again') return 'Bought before';
  return 'Added by you';
}

/** What a group is called when the list goes by drink: the drink, Restock, or Added by you. */
function drinkGroup(row: ShoppingRow, opens: readonly { name?: string }[]): string {
  if (row.source === 'running_low') return 'Restock';
  if (row.forName) return row.forName;
  if (opens.length) return drinkNames(opens);
  return 'Added by you';
}

export type ShoppingMode = 'shop' | 'drink';

/** The open rows in groups, by where you buy them or by what they're for, in the order they first appear. */
export function shoppingGroups(rows: readonly ShoppingRow[], mode: ShoppingMode, oneAway: readonly AwayGroup[]): { title: string; rows: ShoppingRow[] }[] {
  const groups: { title: string; rows: ShoppingRow[] }[] = [];
  for (const row of rows) {
    const title = mode === 'shop' ? shopFor(row.section) : drinkGroup(row, opensWith(row.itemId, oneAway));
    let g = groups.find((x) => x.title === title);
    if (!g) groups.push((g = { title, rows: [] }));
    g.rows.push(row);
  }
  if (mode === 'shop') groups.sort((a, b) => SHOP_ORDER.indexOf(a.title) - SHOP_ORDER.indexOf(b.title));
  return groups;
}

/**
 * How many more drinks the open list makes: those one bottle away for a
 * bottle on it, and those two away when both bottles are on it.
 */
export function listOpens(rows: readonly ShoppingRow[], oneAway: readonly AwayGroup[], twoAway: readonly AwayGroup[]): number {
  const listed = new Set(rows.flatMap((r) => (r.itemId ? [r.itemId] : [])));
  const drinks = new Set<string>();
  for (const g of [...oneAway, ...twoAway]) {
    if (g.bottles.length && g.bottles.every((b) => !!b.id && listed.has(b.id))) for (const d of g.drinks) drinks.add(d.id);
  }
  return drinks.size;
}

/** "6 to get · they open 9 more drinks", or that it's all done. */
export function shoppingSummary(open: number, opens: number): string {
  if (!open) return 'All done. Everything is on your shelf.';
  const get = `${open} to get`;
  if (!opens) return get;
  return `${get} · ${open === 1 ? 'it opens' : 'they open'} ${opens === 1 ? '1 more drink' : `${opens} more drinks`}`;
}

/** What ticking it did, for the Undo toast: "On your shelf. Smoke Signal is ready." */
export function gotLine(row: Pick<ShoppingRow, 'itemId' | 'source' | 'section'>, opens: readonly { name?: string }[]): string {
  if (row.source === 'running_low') return 'Restocked. Running low is off.';
  if (!row.itemId) return 'Crossed off.';
  const where = row.section === 'lab' ? 'On your lab shelf.' : row.section === 'fridge' ? 'In your fridge.' : 'On your shelf.';
  if (opens.length === 1 && opens[0].name) return `${where} ${opens[0].name} is ready.`;
  if (opens.length > 1) return `${where} ${opens.length} more drinks are ready.`;
  return where;
}

/** The list as plain text for a message, by shop. */
export function shoppingText(groups: readonly { title: string; rows: readonly { name: string }[] }[]): string {
  return ['Shopping, from Cocktail', ...groups.map((g) => [g.title, ...g.rows.map((r) => r.name)].join('\n'))].join('\n\n');
}

/** What a home menu needs bought: each drink one or two bottles short, its bottles, for that drink. */
export function menuShopping(drinks: readonly { id: string }[], oneAway: readonly AwayGroup[], twoAway: readonly AwayGroup[]): { itemId: string; name: string; forItemId: string }[] {
  const out: { itemId: string; name: string; forItemId: string }[] = [];
  for (const d of drinks) {
    const group = [...oneAway, ...twoAway].find((g) => g.drinks.some((x) => x.id === d.id));
    for (const b of group?.bottles ?? []) if (b.id && !out.some((o) => o.itemId === b.id)) out.push({ itemId: b.id, name: b.name, forItemId: d.id });
  }
  return out;
}

/**
 * The fruit a citrus juice is squeezed from, as the pantry names it ("Lemon"
 * for lemon juice): nobody buys lemon juice for a home bar (d54). Null for
 * anything else.
 */
export function juiceFruit(name: string): (typeof PANTRY)[number] | null {
  const m = /^(?:fresh |pink |ruby )?(lemon|lime|orange|grapefruit)s? juice$/i.exec(name.trim());
  return m ? (PANTRY.find((p) => p.name.toLowerCase() === m[1].toLowerCase()) ?? null) : null;
}
