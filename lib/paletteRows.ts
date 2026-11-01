/**
 * The ⌘K palette's words (Prod-desk-cmdk): which add leads, why a drink was
 * found, and what a Learn page is called.
 */
import { foldName } from './discover';

type Named = { name: string };
type WithRecipe = Named & { recipes?: { ingredient?: { name?: string | null } | null }[] | null };

/** Add as a new house-made leads when what's typed starts an ingredient's name and no drink's. */
export function madeFirst(groups: { drinks: readonly Named[]; ingredients: readonly Named[] }, query: string): boolean {
  const q = foldName(query.trim());
  const starts = (i: Named) => foldName(i.name).startsWith(q);
  return !!q && groups.ingredients.some(starts) && !groups.drinks.some(starts);
}

/** A drink found by what's in it, not its name: the ingredient that matched ("Grenadine"). */
export function usedFor(drink: WithRecipe, query: string): string | null {
  const q = foldName(query.trim());
  if (!q || foldName(drink.name).includes(q)) return null;
  return (drink.recipes ?? []).map((r) => r.ingredient?.name).find((n): n is string => !!n && foldName(n).includes(q)) ?? null;
}

/**
 * "How to make grenadine": a technique that makes one named thing (its
 * `nameAs` fills in nothing). One that makes many ("Clarified {base}") or a
 * way of making a drink keeps its own name ("Milk washing", "Dry shake").
 */
export function learnTitle(t: Named & { method?: boolean; nameAs?: string }): string {
  if (t.method || !t.nameAs || t.nameAs.includes('{')) return t.name;
  return `How to make ${t.name.charAt(0).toLowerCase()}${t.name.slice(1)}`;
}
