/**
 * One of each ingredient, on the device: the same name key the database uses
 * (public.ingredient_key, 20261008100000), the aliases that point other names
 * at an ingredient, and search that puts the one real ingredient first, so
 * "1:1 sugar syrup" finds Simple Syrup instead of offering to make another.
 * The database refuses a copy anyway; this is so nobody has to hit that wall.
 */

/** Same as public.ingredient_key(): lower case, no accents or punctuation, "&" as "and". */
export function ingredientKey(name: string | null | undefined): string {
  return (name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[øœæ]/g, (c) => (c === 'ø' ? 'o' : ''))
    .replace(/['’‘`´]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9:]+/g, ' ')
    .trim();
}

export interface IngredientRow {
  id: string;
  name: string | null;
  bar_id?: string | null;
  hide_from_search?: boolean | null;
}

/** Another name for a shared ingredient ("1:1 sugar syrup" -> Simple Syrup). */
export interface IngredientAlias {
  key: string;
  item_id: string;
}

/** The ingredient a typed name already is: a shared one with that key, else an alias's. */
export function sameIngredient<T extends IngredientRow>(name: string, rows: readonly T[], aliases: readonly IngredientAlias[] = []): T | null {
  const key = ingredientKey(name);
  if (!key) return null;
  const shared = rows.filter((r) => !r.bar_id);
  const byName = shared.find((r) => ingredientKey(r.name) === key);
  if (byName) return byName;
  const alias = aliases.find((a) => a.key === key);
  return alias ? (rows.find((r) => r.id === alias.item_id) ?? null) : null;
}

/** Edit distance, stopping early once it's past `max`. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/**
 * A shared ingredient the name is probably a misspelling or plural of
 * ("Rasberries" -> Raspberry), for "Did you mean…?". Short names need an exact
 * match: "rum" and "gum" are both real.
 */
export function nearIngredient<T extends IngredientRow>(name: string, rows: readonly T[], aliases: readonly IngredientAlias[] = []): T | null {
  const key = ingredientKey(name);
  if (key.length < 5 || sameIngredient(name, rows, aliases)) return null;
  const max = key.length < 9 ? 1 : 2;
  const singular = (k: string) => k.replace(/(ies)$/, 'y').replace(/(?<![s])s$/, '');
  let best: { row: T; d: number } | null = null;
  for (const r of rows) {
    if (r.bar_id || r.hide_from_search) continue;
    const k = ingredientKey(r.name);
    const d = singular(k) === singular(key) ? 0 : distance(k, key, max);
    if (d <= max && (!best || d < best.d)) best = { row: r, d };
  }
  return best?.row ?? null;
}

/**
 * Ingredients for what's typed: the one it already is (by name or alias)
 * first, then core ingredients, then the rest; names that start with it
 * before ones that contain it. One-off bottles and preps hidden from search
 * only show when typed in full.
 */
export function searchIngredients<T extends IngredientRow>(
  query: string,
  rows: readonly T[],
  opts: { aliases?: readonly IngredientAlias[]; coreIds?: ReadonlySet<string>; limit?: number } = {}
): T[] {
  const q = ingredientKey(query);
  if (!q) return [];
  const { aliases = [], coreIds = new Set<string>(), limit = 6 } = opts;
  const same = sameIngredient(query, rows, aliases);
  const aliasHits = new Set(aliases.filter((a) => a.key.startsWith(q)).map((a) => a.item_id));
  const scored: { r: T; s: number }[] = [];
  for (const r of rows) {
    if (r === same) continue;
    const k = ingredientKey(r.name);
    const starts = k.startsWith(q) || aliasHits.has(r.id);
    const contains = !starts && k.includes(q);
    if (!starts && !contains) continue;
    if (r.hide_from_search && k !== q) continue;
    // Lower is better: start before contain, core before the rest, then shorter.
    scored.push({ r, s: (starts ? 0 : 2) + (coreIds.has(r.id) ? 0 : 1) });
  }
  scored.sort((a, b) => a.s - b.s || (a.r.name ?? '').length - (b.r.name ?? '').length);
  return [...(same ? [same] : []), ...scored.map((x) => x.r)].slice(0, limit);
}

/** The id the database pointed at when it refused a copy (its hint), if any. */
export function existingIngredientId(error: unknown): string | null {
  const e = error as { code?: string; hint?: string | null } | null;
  return e?.code === 'P0001' && e.hint && /^[0-9a-f-]{36}$/i.test(e.hint) ? e.hint : null;
}
