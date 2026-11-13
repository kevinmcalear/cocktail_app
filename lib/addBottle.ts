/**
 * The words and choices of A bottle you buy (board Add-bottle), kept apart
 * from the screen so lib/addBottle.check.ts can run them:
 * components/screens/addIngredient/AddBottle.tsx.
 */
import { ingredientKey, kindWords, searchIngredients, type IngredientAlias } from './ingredientNames';

export interface BottleRow {
  id: string;
  name: string | null;
  bar_id?: string | null;
  hide_from_search?: boolean | null;
  generic_id?: string | null;
  ingredient_role?: string | null;
  brand_maker?: string | null;
}

/**
 * "Is it this one?": bottles (not house-mades or kinds) whose name has what's
 * typed, from the shared catalog and the venue's own. Two, as the board
 * draws, so the new one row stays in sight.
 */
export function bottleMatches<T extends BottleRow>(name: string, rows: readonly T[], barId: string | null, opts: { aliases?: readonly IngredientAlias[]; coreIds?: ReadonlySet<string> } = {}): T[] {
  if (ingredientKey(name).length < 2) return [];
  return searchIngredients(name, rows, { ...opts, limit: 12 })
    .filter((r) => r.ingredient_role === 'product' && (!r.bar_id || r.bar_id === barId))
    .slice(0, 2);
}

/** The venue's own bottle by this name: the database lets a venue have one beside a shared one, so it's looked for apart. */
export function ownBottle<T extends BottleRow>(name: string, rows: readonly T[], barId: string | null): T | null {
  const key = ingredientKey(name);
  if (!barId || !key) return null;
  return rows.find((r) => r.bar_id === barId && ingredientKey(r.name) === key) ?? null;
}

/** "Laphroaig · 40% · Islay scotch": who makes it, how strong, what it's a kind of, as far as known. */
export function bottleFacts(maker: string | null | undefined, abv: number | null | undefined, kind: string | null | undefined): string {
  return [maker?.trim(), abv !== null && abv !== undefined ? `${abv}%` : null, kind?.trim()].filter(Boolean).join(' · ');
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Name taken: "Campari is already here / On the back bar since March, in 6
 * drinks. Use that one, or give this bottle a name that tells them apart."
 * At home it's your shelf.
 */
export function takenWords(name: string, atBar: boolean, here: { since: string | null; drinks: number }): { title: string; body: string } {
  const month = here.since ? MONTHS[new Date(here.since).getMonth()] : null;
  const where = atBar
    ? [`On the back bar${month ? ` since ${month}` : ''}`, here.drinks ? `in ${here.drinks} drink${here.drinks === 1 ? '' : 's'}` : null].filter(Boolean).join(', ')
    : 'On your shelf';
  return { title: atBar ? `${name} is already here` : `${name} is already on your shelf`, body: `${where}. Use that one, or give this bottle a name that tells them apart.` };
}

/** The name is already a house-made, a kind or a plain ingredient: open it, or name the bottle apart. */
export function notABottleWords(name: string, role: string | null | undefined): { title: string; body: string } {
  const what = role === 'prep' ? 'It’s a house-made' : role === 'generic' ? 'It’s a kind that bottles belong to' : 'It’s an ingredient';
  return { title: `${name} is already here`, body: `${what}, not a bottle you buy. Open it, or give this bottle a name that tells them apart.` };
}

/** Where its kind came from, said under A kind of: "Drinks that call for Islay scotch can use it. Picked from the label; change it here." */
export function kindHelp(kind: string | null, from: 'label' | 'name' | 'you' | 'catalog'): string | null {
  if (!kind) return 'Pick what it’s a kind of, and drinks that call for that can use it.';
  const can = `Drinks that call for ${kindWords(kind)} can use it.`;
  if (from === 'label') return `${can} Picked from the label; change it here.`;
  if (from === 'name') return `${can} Picked from the name; change it here.`;
  return can;
}

/**
 * The toast once it's saved: "It's on Bottles, and any drink that calls for
 * Islay scotch can use it." (Add-bottle, Done). It names only a list the
 * person has: a bar's Bottles is behind its More drink filters switch
 * (lib/venueFeatures.ts), so without it the toast says what the bottle does.
 */
export function savedDetail(where: 'bottles' | 'bar' | 'shelf', kind: string | null): string {
  const can = kind ? `any drink that calls for ${kindWords(kind)} can use it.` : null;
  if (where === 'bar') return can ? `${can[0].toUpperCase()}${can.slice(1)}` : 'Drinks here can use it now.';
  const on = where === 'bottles' ? 'It’s on Bottles' : 'It’s on your shelf';
  return can ? `${on}, and ${can}` : `${on}.`;
}

/** ABV as typed ("40", "40,5", ".5") to a number, or null when it isn't one from 0 to 100. */
export function abvNumber(s: string): number | null {
  const t = s.trim();
  if (!/^(\d+([.,]\d*)?|[.,]\d+)$/.test(t)) return null;
  const n = Number(t.replace(',', '.'));
  return n <= 100 ? n : null;
}

/** What's wrong with a strength as typed, said under the field (it blocks Save): nothing when it's empty or fine. */
export function abvError(s: string): string | null {
  return s.trim() && abvNumber(s) === null ? 'A strength is a percent from 0 to 100, like 40 or 40.5.' : null;
}
