import { formatScore } from './ranking';

/** One drink at a bar and how people rank it there (get_bar_top_drinks). */
export interface BarTopDrink {
  /** Set, with score, once enough people have ranked it. Null while early or unranked. */
  position: number | null;
  item_id: string;
  name: string;
  /** The bar's own drink, published; null for a shared drink (a signature or a classic). */
  bar_id: string | null;
  ranked_as_item_id: string;
  /** The classic it's ranked as ("Martini"), when that isn't the drink itself. */
  ranked_as_name: string | null;
  image_url: string | null;
  image_is_generated: boolean | null;
  score: number | null;
  /** How many people have ranked it here: one rating each. */
  rankers: number;
  /** On a live menu or the latest one, or only on older ones. */
  menu: 'current' | 'past' | null;
  /** The first and last year a menu listed it. */
  menu_from: number | null;
  menu_to: number | null;
}

/** PostgREST sends numerics as strings. */
export function toTopDrink(row: BarTopDrink): BarTopDrink {
  return { ...row, score: row.score === null ? null : Number(row.score), position: row.position === null ? null : Number(row.position) };
}

/** Scored drinks (best first), early ones (some ratings, no score) and ones nobody has ranked, in the RPC's order. */
export function splitTopDrinks(rows: readonly BarTopDrink[]) {
  return {
    scored: rows.filter((r) => r.position !== null && r.score !== null),
    early: rows.filter((r) => r.score === null && r.rankers > 0),
    unranked: rows.filter((r) => r.score === null && r.rankers === 0),
  };
}

/** "1 rating", "64 ratings". */
export function ratingCount(n: number): string {
  return n === 1 ? '1 rating' : `${n} ratings`;
}

/** "Past · 2024 to 2025" for a drink only older menus listed; null otherwise. */
export function pastMenuLabel(d: Pick<BarTopDrink, 'menu' | 'menu_from' | 'menu_to'>): string | null {
  if (d.menu !== 'past') return null;
  if (d.menu_from === null || d.menu_to === null) return 'Past menu';
  return d.menu_from === d.menu_to ? `Past · ${d.menu_from}` : `Past · ${d.menu_from} to ${d.menu_to}`;
}

/** "Gimlet · 64 ratings · on now": the classic it's a version of, how many rated it, and whether it's on now. */
export function topDrinkCaption(d: BarTopDrink): string {
  return [d.ranked_as_name, d.rankers ? ratingCount(d.rankers) : null, d.menu === 'current' ? 'on now' : null].filter(Boolean).join(' · ');
}

/** What a screen reader hears for a row. */
export function topDrinkLabel(d: BarTopDrink): string {
  return [
    `${d.position ? `Number ${d.position}: ` : ''}${d.name}${d.ranked_as_name ? `, a ${d.ranked_as_name}` : ''}`,
    d.score !== null ? `Score ${formatScore(d.score)} from ${ratingCount(d.rankers)}` : d.rankers ? `${ratingCount(d.rankers)}, no score yet` : 'Not rated yet',
    d.menu === 'current' ? 'On the menu now' : pastMenuLabel(d)?.replace('·', 'menu,'),
  ]
    .filter(Boolean)
    .join('. ');
}

/** A bar's published drink opens its public page; a shared drink opens the drink page. */
export function topDrinkHref(d: Pick<BarTopDrink, 'item_id' | 'bar_id'>): string {
  return d.bar_id ? `/d/${d.item_id}` : `/cocktail/${d.item_id}`;
}
