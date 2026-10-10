/**
 * Which classic a new spec is close to, by what goes in: "Close to a Mezcal
 * Margarita. Make it a riff?" on the wizard's ingredients step. Ingredients
 * compare as their generic (a Del Maguey Vida line is Mezcal), as ids.
 */

export interface ClassicSpec {
  id: string;
  name: string;
  /** Its ingredients' ids, each its generic's where it has one. */
  ingredients: readonly string[];
}

/** Close enough to say so: the share of both specs' ingredients that are the same. */
const CLOSE = 0.5;

/**
 * The classic sharing at least two ingredients and at least half of the two
 * specs together (Jaccard), best first; a tie goes to the shorter classic.
 * Null when nothing is that close.
 */
export function closestClassic<C extends ClassicSpec>(mine: readonly string[], specs: readonly C[]): C | null {
  const have = new Set(mine);
  if (have.size < 2) return null;
  let best: { spec: C; score: number; size: number } | null = null;
  for (const spec of specs) {
    const theirs = new Set(spec.ingredients);
    let shared = 0;
    for (const id of theirs) if (have.has(id)) shared += 1;
    if (shared < 2) continue;
    const score = shared / (have.size + theirs.size - shared);
    if (!best || score > best.score || (score === best.score && theirs.size < best.size)) best = { spec, score, size: theirs.size };
  }
  return best && best.score >= CLOSE ? best.spec : null;
}

/** "a Mezcal Margarita", "an Old Fashioned". */
export function withArticle(name: string): string {
  return `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`;
}
