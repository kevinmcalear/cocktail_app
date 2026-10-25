// A spec checked against your shelf, for the drink page's "At home" section
// (board drink-phone-home): how many lines you have, and which you don't.
// The server's my_bar_drinks does the matching (kinds, pantry staples,
// house preps); this only reads its verdict for one drink.

import type { SpecLine } from './spec';

/** my_bar_drinks' verdict for one drink: ready, one or two bottles short, or further than that. */
export type ShelfVerdict = { ready: true } | { ready: false; buy: { id: string; name: string }[] } | null;

export interface ShelfCheck {
  /** Lines you have, of the lines that count (not optional). */
  have: number;
  total: number;
  /** Spec line keys you don't have. */
  missing: string[];
  /** Each missing line's bottle to buy, by line key: what the shopping list holds for it. */
  buyFor: Record<string, string>;
  /** The bottles to buy, by name. */
  buy: string[];
  /** Three or more short: the server doesn't say which. */
  far: boolean;
}

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

/**
 * Each bottle to buy marks the line that names it: by id, by the kind the
 * line's bottle is (my_bar_drinks asks for "Herbal Liqueur" when the spec
 * says Green Chartreuse), else by name. `kindOf` maps a line's ingredient id
 * to its generic's id.
 */
export function checkShelf(lines: SpecLine[], verdict: ShelfVerdict, kindOf: Record<string, string | null> = {}): ShelfCheck | null {
  const counted = lines.filter((l) => l.ingredient && !l.optional);
  if (!counted.length) return null;
  if (verdict?.ready) return { have: counted.length, total: counted.length, missing: [], buyFor: {}, buy: [], far: false };
  if (!verdict) return { have: Math.max(counted.length - 3, 0), total: counted.length, missing: [], buyFor: {}, buy: [], far: true };
  const buyFor: Record<string, string> = {};
  const missing = verdict.buy.flatMap((b) => {
    const line =
      counted.find((l) => l.ingredientId === b.id) ??
      counted.find((l) => !!l.ingredientId && kindOf[l.ingredientId] === b.id) ??
      counted.find((l) => norm(l.ingredient) === norm(b.name));
    if (line) buyFor[line.key] = b.id;
    return line ? [line.key] : [];
  });
  const short = Math.max(missing.length, verdict.buy.length);
  return { have: Math.max(counted.length - short, 0), total: counted.length, missing, buyFor, buy: verdict.buy.map((b) => b.name), far: false };
}

/** "You have 4 of 5", "You have them all", "Three or more short". */
export function shelfCaption(c: ShelfCheck): string {
  if (c.far) return 'Three or more short';
  return c.have === c.total ? 'You have them all' : `You have ${c.have} of ${c.total}`;
}

/** The journey strip's To make line: "Need Cynar", "Ready to make", or the count. */
export function shelfNeed(c: ShelfCheck): string {
  if (c.far) return shelfCaption(c);
  if (!c.buy.length) return 'Ready to make';
  return c.buy.length === 1 ? `Need ${c.buy[0]}` : `You have ${c.have} of ${c.total}`;
}
