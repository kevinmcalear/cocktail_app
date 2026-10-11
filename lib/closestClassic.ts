/**
 * Which classic a new spec is close to, by what goes in: "Close to a Mezcal
 * Margarita. Make it a riff?" on the wizard's ingredients step. Ingredients
 * compare by id; one that only shares its generic (a Del Maguey Vida line
 * against a classic's Mezcal, both Agave Spirit) counts half.
 */

/** An ingredient: its id, and its generic's ("Agave Spirit") when it has one. */
export interface SpecIngredient {
  id: string;
  generic?: string | null;
}

export interface ClassicSpec {
  id: string;
  name: string;
  ingredients: readonly SpecIngredient[];
}

/** Close enough to say so: the share of both specs' ingredients that are the same. */
const CLOSE = 0.5;

/**
 * The classic sharing at least two ingredients (by id or generic) and at
 * least half of the two specs together (Jaccard, a generic-only match
 * counting half), best first; a tie goes to the shorter classic. Null when
 * nothing is that close.
 */
export function closestClassic<C extends ClassicSpec>(mine: readonly SpecIngredient[], specs: readonly C[]): C | null {
  const have = [...new Map(mine.map((m) => [m.id, m])).values()];
  if (have.length < 2) return null;
  let best: { spec: C; score: number; size: number } | null = null;
  for (const spec of specs) {
    const ids = new Set(spec.ingredients.map((i) => i.id));
    const generics = new Set(spec.ingredients.map((i) => i.generic ?? i.id));
    let shared = 0;
    let touching = 0;
    for (const m of have) {
      if (ids.has(m.id)) shared += 1;
      else if (generics.has(m.generic ?? m.id)) shared += 0.5;
      else continue;
      touching += 1;
    }
    if (touching < 2) continue;
    const score = shared / (have.length + ids.size - touching);
    if (!best || score > best.score || (score === best.score && ids.size < best.size)) best = { spec, score, size: ids.size };
  }
  return best && best.score >= CLOSE ? best.spec : null;
}

/** "a Mezcal Margarita", "an Old Fashioned". */
export function withArticle(name: string): string {
  return `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`;
}
