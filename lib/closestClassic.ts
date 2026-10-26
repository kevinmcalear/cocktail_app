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

/** How close one classic is: the shared share (Jaccard, a generic-only match counting half), how many of mine it touches, and its lines that do. */
function closeness<C extends ClassicSpec>(have: readonly SpecIngredient[], spec: C) {
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
  // Each of mine names one line: the same bottle, else one of it or it of one (Gin and London dry gin), else a sibling.
  const find = (ok: (i: SpecIngredient, m: SpecIngredient) => boolean) => (m: SpecIngredient) => spec.ingredients.find((i) => ok(i, m));
  const same = find((i, m) => i.id === m.id);
  const kin = find((i, m) => i.generic === m.id || m.generic === i.id);
  const sibling = find((i, m) => (i.generic ?? i.id) === (m.generic ?? m.id));
  const named = have.flatMap((m) => same(m) ?? kin(m) ?? sibling(m) ?? []);
  const lines = spec.ingredients.filter((i) => named.includes(i)) as C['ingredients'][number][];
  return { spec, score: touching ? shared / (have.length + ids.size - touching) : 0, shared, touching, size: ids.size, lines };
}

const unique = (mine: readonly SpecIngredient[]) => [...new Map(mine.map((m) => [m.id, m])).values()];

/**
 * The classic sharing at least two ingredients (by id or generic) and at
 * least half of the two specs together (Jaccard, a generic-only match
 * counting half), best first; a tie goes to the shorter classic. Null when
 * nothing is that close.
 */
export function closestClassic<C extends ClassicSpec>(mine: readonly SpecIngredient[], specs: readonly C[]): C | null {
  const have = unique(mine);
  if (have.length < 2) return null;
  let best: ReturnType<typeof closeness<C>> | null = null;
  for (const spec of specs) {
    const c = closeness(have, spec);
    if (c.touching < 2) continue;
    if (!best || c.score > best.score || (c.score === best.score && c.size < best.size)) best = c;
  }
  return best && best.score >= CLOSE ? best.spec : null;
}

/**
 * Up to `n` classics sharing anything with the spec, for "Is it a riff on one
 * of these?" (board w2-wizard-steps, Q25): the most shared first, then the
 * closest, then the shorter. Each with its own lines that are shared, for
 * "Shares mezcal, lime, agave".
 */
export function closeClassics<C extends ClassicSpec>(mine: readonly SpecIngredient[], specs: readonly C[], n = 4): { spec: C; lines: C['ingredients'][number][] }[] {
  const have = unique(mine);
  return specs
    .map((spec) => closeness(have, spec))
    .filter((c) => c.touching > 0)
    .sort((a, b) => b.shared - a.shared || b.score - a.score || a.size - b.size || a.spec.name.localeCompare(b.spec.name))
    .slice(0, n)
    .map(({ spec, lines }) => ({ spec, lines }));
}

/** "a Mezcal Margarita", "an Old Fashioned". */
export function withArticle(name: string): string {
  return `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`;
}
