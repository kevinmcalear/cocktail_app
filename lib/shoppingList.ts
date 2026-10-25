/**
 * The shopping list (design B, canvas 8w6AQdWxjj9UHacXufv89J): where each
 * thing is bought, why it's on the list, how the list groups, and the text
 * Share sends. Pure helpers (lib/shoppingList.check.ts).
 */
import type { BarSection } from '@/lib/barSections';
import { PANTRY, PANTRY_WATER } from '@/lib/pantry';
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

/**
 * Why it's on the list: "Running low", "For Smoke Signal", "Opens 4 drinks: Boulevardier, Fanciulli +2", "Added by you".
 * Added by hand for a house-made thing (Lemons for lemon juice): the drinks it opens, else that thing ("For Lemon juice").
 */
export function whyLine(row: Pick<ShoppingRow, 'source' | 'forName'>, opens: readonly { name?: string }[]): string {
  if (row.source === 'running_low') return 'Running low';
  if (row.forName && row.source !== 'hand') return `For ${row.forName}`;
  if (opens.length > 1) return `Opens ${opens.length} drinks: ${drinkNames(opens)}`;
  if (opens.length === 1 && opens[0].name) return `For ${opens[0].name}`;
  if (row.forName) return `For ${row.forName}`;
  if (row.source === 'again') return 'Bought before';
  return 'Added by you';
}

/** What a group is called when the list goes by drink: the drink, Restock, or Added by you. */
function drinkGroup(row: ShoppingRow, opens: readonly { name?: string }[]): string {
  if (row.source === 'running_low') return 'Restock';
  if (row.forName && row.source !== 'hand') return row.forName;
  if (opens.length) return drinkNames(opens);
  return row.forName ?? 'Added by you';
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

/** A pantry staple as the list says it ("Limes", not "Lime"); anything else as it's named. */
export function shopName(name: string): string {
  return PANTRY.find((p) => p.name.toLowerCase() === name.toLowerCase())?.label ?? name;
}

type Part = { id: string; name: string };

// What's cut or squeezed from a staple: its juice, peel or white, not a bottle that's only filed under it.
const FROM_STAPLE = /\b(juice|peel|zest|twist|wheel|wedge|white|yolk)s?\b/i;

/** Things that come from a pantry staple (lemon juice from Lemon), by id: each name's kind, when it's a staple. */
export function staplesFrom(things: readonly { id: string; name: string }[], kindOf: Readonly<Record<string, string | null>>, pantry: readonly Part[]): Record<string, Part> {
  const out: Record<string, Part> = {};
  for (const t of things) {
    const staple = FROM_STAPLE.test(t.name) ? pantry.find((p) => p.id === kindOf[t.id] && p.name !== PANTRY_WATER) : undefined;
    if (staple) out[t.id] = staple;
  }
  return out;
}

type Lines = Readonly<Record<string, { lines: readonly { id: string; name: string }[] } | undefined>>;

/**
 * What to buy to make a house-made thing: a pantry staple it comes from
 * (`staples`, by its kind: lemon juice and lime peel are kinds of Lemon and
 * Lime), else its recipe's parts you don't have, a house-made part by its own
 * parts (two deep). Water never. Lemon juice gives Lemons; lime cordial
 * (sugar, lime juice, lime peel) gives Sugar and Limes.
 */
export function madeFrom(id: string, recipes: Lines, onShelf: ReadonlySet<string>, staples: Readonly<Record<string, Part>>, depth = 0): Part[] {
  const staple = staples[id];
  if (staple) return onShelf.has(staple.id) ? [] : [{ id: staple.id, name: shopName(staple.name) }];
  const out: Part[] = [];
  for (const l of recipes[id]?.lines ?? []) {
    if (onShelf.has(l.id) || l.name === PANTRY_WATER) continue;
    const parts = staples[l.id] || (depth < 1 && recipes[l.id]?.lines.length) ? madeFrom(l.id, recipes, onShelf, staples, depth + 1) : [{ id: l.id, name: shopName(l.name) }];
    for (const p of parts) if (!out.some((o) => o.id === p.id)) out.push(p);
  }
  return out;
}

/**
 * Add by hand's line for something made: "Squeezed from limes, so adds Limes",
 * "Comes from eggs, so adds Eggs", "House-made: adds Limes and Sugar".
 * `staple`: it comes straight from a pantry staple, not a recipe.
 */
export function madeFromLine(name: string, parts: readonly { name: string }[], staple = false): string {
  if (staple && parts.length === 1) return `${/\bjuice\b/i.test(name) ? 'Squeezed' : 'Comes'} from ${parts[0].name.toLowerCase()}, so adds ${parts[0].name}`;
  if (!parts.length) return staple ? 'You have what it comes from' : 'House-made. You have what goes in it';
  const names = parts.map((p) => p.name);
  return `House-made: adds ${names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0]}`;
}

export interface HandRow {
  note: string;
  label: 'Add' | 'Running low';
  /** What a screen reader says the button does. */
  say: string;
  adds: { itemId: string; name: string; source: 'hand' | 'running_low'; forItemId?: string }[];
}

/**
 * One Add by hand result (shopping In 4, d54): a thing on your shelf can run
 * low; a juice whose fruit you have marks the fruit running low; anything made
 * adds what it's made from; the rest goes on as itself. Works from whatever has
 * loaded: with no recipe or kind yet it's a plain row.
 */
export function handRow(
  f: { id: string; name: string; section: BarSection },
  { onShelf, have, recipes, staples }: { onShelf: ReadonlySet<string>; have: ReadonlySet<string>; recipes: Lines; staples: Readonly<Record<string, Part>> }
): HandRow {
  if (onShelf.has(f.id)) return { note: 'On your shelf', label: 'Running low', say: `Mark ${f.name} running low`, adds: [{ itemId: f.id, name: f.name, source: 'running_low' }] };
  const staple = staples[f.id];
  // The staple itself on the shelf, not a bottle that only covers its kind in a recipe.
  if (staple && onShelf.has(staple.id)) {
    const name = shopName(staple.name);
    return { note: `From ${name.toLowerCase()}, so it can mark yours running low`, label: 'Running low', say: `Mark ${name} running low`, adds: [{ itemId: staple.id, name, source: 'running_low' }] };
  }
  const made = !!recipes[f.id]?.lines.length;
  const parts = staple || made ? madeFrom(f.id, recipes, have, staples) : [];
  if (parts.length) {
    return { note: madeFromLine(f.name, parts, !!staple), label: 'Add', say: `Add ${parts.map((p) => p.name).join(' and ')} for ${f.name}`, adds: parts.map((p) => ({ itemId: p.id, name: p.name, source: 'hand', forItemId: f.id })) };
  }
  return { note: made ? madeFromLine(f.name, []) : shopFor(f.section), label: 'Add', say: `Add ${f.name}`, adds: [{ itemId: f.id, name: f.name, source: 'hand' }] };
}
