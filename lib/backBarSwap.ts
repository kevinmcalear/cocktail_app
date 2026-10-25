import { andList } from '@/lib/makers';
import { groupMenus, plural } from '@/lib/menus';
import { planSwap, type SwapDrink, type SwapHit } from '@/lib/swapBottle';
import type { MenuSummary } from '@/types/menus';

/** One drink or house prep that pours a bottle on the back bar. */
export interface PourRow {
  hit: SwapHit;
  house: boolean;
  /** "On the Autumn menu", "R&D", "House-made · changes with the drinks". */
  detail: string;
}

function theMenu(name: string): string {
  const n = name.trim();
  return /\bmenu$/i.test(n) ? `the ${n}` : `the ${n} menu`;
}

/**
 * Everything at the venue that pours one bottle (that bottle only, not its
 * kind), for the back bar's Replace and Take it off: drinks on a menu that's
 * on first, so the question names the one guests order tonight, then coming
 * up, the rest, R&D, and the house preps and batches last. Preps are swapped
 * with the drinks here, unlike the Library's swap.
 */
export function pourersOf(
  drinks: SwapDrink[],
  bottleId: string,
  replace: { id: string; name: string } | null,
  names: Record<string, string>,
  menus: MenuSummary[],
  now: number,
): PourRow[] {
  const { hits } = planSwap(drinks, bottleId, replace?.id ?? '', 'bottle', null, names, replace?.name ?? '', true);
  const groups = groupMenus(menus, now);
  const where = new Map<string, { rank: number; detail: string }>();
  const mark = (list: MenuSummary[], rank: number, detail: (menu: MenuSummary) => string) => {
    for (const menu of list) for (const id of menu.itemIds) if (!where.has(id)) where.set(id, { rank, detail: detail(menu) });
  };
  mark(groups.on, 0, (menu) => `On ${theMenu(menu.name)}`);
  mark(groups.upcoming, 1, (menu) => `Coming up on ${theMenu(menu.name)}`);
  mark(groups.rnd, 3, () => 'R&D');
  const rows = hits.map((hit) => {
    const house = hit.drink.itemType === 'ingredient';
    const at = house
      ? { rank: 4, detail: 'House-made · changes with the drinks' }
      : (where.get(hit.drink.id) ?? { rank: 2, detail: hit.changes.map((change) => `${change.amount} ${change.from}`.trim()).join(', ') });
    return { hit, house, detail: at.detail, rank: at.rank };
  });
  return rows.sort((a, b) => a.rank - b.rank).map(({ hit, house, detail }) => ({ hit, house, detail }));
}

/** "3 drinks and 1 house-made ingredient", "4 drinks", "1 house-made ingredient". */
export function pourCount(rows: PourRow[]): string {
  const preps = rows.filter((row) => row.house).length;
  const drinks = rows.length - preps;
  return andList([drinks ? plural(drinks, 'drink') : '', preps ? plural(preps, 'house-made ingredient') : ''].filter(Boolean));
}

/** The question over the swap: "Your Naked and Famous uses this. Swap it?" */
export function swapQuestion(rows: PourRow[]): string {
  if (!rows.length) return 'Nothing pours it. Swap it?';
  return `Your ${rows[0].hit.drink.name} uses this. Swap it?`;
}

/** "4 drinks and preps still pour it: Naked and Famous, Mezcal Negroni and Ash Garden batch." */
export function stillPours(rows: PourRow[]): string {
  const shown = rows.slice(0, 4).map((row) => row.hit.drink.name);
  const more = rows.length - shown.length;
  const list = more > 0 ? `${shown.join(', ')} and ${plural(more, 'more', 'more')}` : andList(shown);
  return `${pourCount(rows)} still ${rows.length === 1 ? 'pours' : 'pour'} it: ${list}.`;
}

/** Step one's line under the bottle: "Mezcal · Top shelf, left · used in 4 drinks". */
export function bottleLine(kind: string | null, shelf: string | null, rows: PourRow[]): string {
  return [kind, shelf?.trim() || null, rows.length ? `used in ${pourCount(rows)}` : null].filter(Boolean).join(' · ');
}
