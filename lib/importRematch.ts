// Kept as house-made, a review's drinks match it again (lib/importReview.ts).
// Its own file because it reads a batch's lines (lib/readBatch.ts, which pulls
// the prep kinds and techniques): the review itself is in the bring-in store,
// on Tonight's and Drinks' first load, and this is only used while checking.

import { canCheck, type ImportReview } from '@/lib/importReview';
import { drinkRecipe } from '@/lib/readBatch';
import { sameName } from '@/lib/sameName';

/**
 * Kept as house-made: the drinks still to check that call for it match it
 * again. A line someone set to "make it new" goes back to matching, so it
 * finds the house-made once the catalog has it; picks stay as picked.
 */
export function rematch(review: ImportReview, name: string): ImportReview {
  const choices = review.choices.map((c, k) => {
    if (!canCheck(review, k)) return c;
    // Choices follow the lines as shown (a batch kept as separate lines included).
    const shown = review.recipes[k] ? drinkRecipe(review.recipes[k], c).lines : [];
    const lines = Object.fromEntries(Object.entries(c.lines).filter(([at, choice]) => !('fresh' in choice && sameName(shown[Number(at)]?.ingredient ?? '', name))));
    return Object.keys(lines).length === Object.keys(c.lines).length ? c : { ...c, lines };
  });
  return { ...review, choices };
}
