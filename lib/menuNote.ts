/**
 * The desktop drink page's one line about the menu a new drink is going on
 * (board make-create-desktop, step 7): "On Winter menu it's the lightest
 * drink, and the only sherry one." Strength is the taste profile's (lib/balance),
 * the drink's main pour its largest line of something 15% or stronger.
 */
import { ruleFor } from '../supabase/functions/_shared/flavor';

import { balanceOf, type BalanceLine } from './balance';
import { toMl } from './drinkMath';

export interface MenuDrinkSpec {
  name: string;
  lines: BalanceLine[];
}

/** What the drink's largest strong pour is a kind of ("sherry" for Fino sherry), or null. */
export function mainPour(lines: readonly BalanceLine[]): string | null {
  let best: { word: string; ml: number } | null = null;
  for (const l of lines) {
    const rule = ruleFor({ name: l.name, genericName: l.genericName ?? null });
    const ml = l.amount != null ? toMl(l.amount, l.unit, 1) : null;
    if (!rule || rule.abv < 0.15 || ml == null) continue;
    if (!best || ml > best.ml) best = { word: (l.genericName ?? l.name).trim().toLowerCase(), ml };
  }
  return best?.word ?? null;
}

const has = (lines: readonly BalanceLine[], word: string) => lines.some((l) => `${l.name} ${l.genericName ?? ''}`.toLowerCase().includes(word));

/** The line, or null when there's nothing to say (fewer than two other drinks we can read, nothing that stands out). */
export function menuNote(menu: string, drink: readonly BalanceLine[], others: readonly MenuDrinkSpec[]): string | null {
  const mine = balanceOf(drink);
  if (!mine) return null;
  const read = others.map((o) => balanceOf(o.lines)).filter((b) => b !== null);
  const parts: string[] = [];
  if (read.length >= 2) {
    if (read.every((b) => mine.strong < b.strong)) parts.push('the lightest drink');
    else if (read.every((b) => mine.strong > b.strong)) parts.push('the strongest drink');
  }
  const pour = mainPour(drink);
  if (pour && others.length >= 2 && !others.some((o) => has(o.lines, pour))) parts.push(`the only ${pour} one`);
  if (!parts.length) return null;
  return `On ${menu} it’s ${parts.join(', and ')}.`;
}
