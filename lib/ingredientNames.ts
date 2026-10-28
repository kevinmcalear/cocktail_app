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

/** A list's names, keyed once: what every search below reads instead of cleaning 20,000 names on every letter. */
interface NameIndex<T> {
  /** ingredientKey of each row's name, in the list's order. */
  keys: string[];
  /** Each key's words, made the first time a search asks. */
  words?: string[][];
  /** The first shared row with each key. */
  shared: Map<string, T>;
  byId: Map<string, T>;
  /** The rows under each kind (generic_id), made the first time bottlesOfKind asks. */
  under?: Map<string, T[]>;
}

// One index per list, kept while the list is: a picker's list stays the same array while you type.
const INDEXES = new WeakMap<readonly IngredientRow[], NameIndex<IngredientRow>>();
const ALIASES = new WeakMap<readonly IngredientAlias[], Map<string, string>>();

function indexOf<T extends IngredientRow>(rows: readonly T[]): NameIndex<T> {
  let index = INDEXES.get(rows) as NameIndex<T> | undefined;
  if (!index) {
    const keys = rows.map((r) => ingredientKey(r.name));
    const shared = new Map<string, T>();
    const byId = new Map<string, T>();
    rows.forEach((r, i) => {
      if (!byId.has(r.id)) byId.set(r.id, r);
      if (!r.bar_id && !shared.has(keys[i])) shared.set(keys[i], r);
    });
    index = { keys, shared, byId };
    INDEXES.set(rows, index as NameIndex<IngredientRow>);
  }
  return index;
}

const wordsOf = <T extends IngredientRow>(index: NameIndex<T>) => (index.words ??= index.keys.map((k) => k.split(' ')));

function aliasOf(aliases: readonly IngredientAlias[], key: string): string | undefined {
  let byKey = ALIASES.get(aliases);
  if (!byKey) {
    byKey = new Map();
    for (const a of aliases) if (!byKey.has(a.key)) byKey.set(a.key, a.item_id);
    ALIASES.set(aliases, byKey);
  }
  return byKey.get(key);
}

/** The ingredient a typed name already is: a shared one with that key, else an alias's. */
export function sameIngredient<T extends IngredientRow>(name: string, rows: readonly T[], aliases: readonly IngredientAlias[] = []): T | null {
  const key = ingredientKey(name);
  if (!key) return null;
  const index = indexOf(rows);
  const byName = index.shared.get(key);
  if (byName) return byName;
  const alias = aliasOf(aliases, key);
  return alias ? (index.byId.get(alias) ?? null) : null;
}

// A kind said after a bottle's name: "Del Maguey Vida mezcal", "Old Forester bourbon".
const TRAILING_KIND = /\s+(mezcal|tequila|gin|rum|rhum|vodka|whisky|whiskey|bourbon|rye|scotch|brandy|cognac|armagnac|calvados|pisco|cachaca|cachaça|vermouth|amaro|liqueur|aperitivo|aperitif|sherry|port|absinthe|bitters)$/i;

/**
 * The ingredient a typed name already is, said with or without its kind
 * after it: "Del Maguey Vida mezcal" is Del Maguey Vida. Two words have to
 * be left, so "Rye whiskey" is never Rye.
 */
export function sameBottle<T extends IngredientRow>(name: string, rows: readonly T[], aliases: readonly IngredientAlias[] = []): T | null {
  const same = sameIngredient(name, rows, aliases);
  if (same) return same;
  const bare = name.trim().replace(TRAILING_KIND, '');
  return bare !== name.trim() && bare.split(/\s+/).length >= 2 ? sameIngredient(bare, rows, aliases) : null;
}

/** Edit distance, stopping early once it's past `max`. Strings, or arrays of characters. */
export function distance(a: ArrayLike<string>, b: ArrayLike<string>, max: number): number {
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
  const { keys } = indexOf(rows);
  let best: { row: T; d: number } | null = null;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.bar_id || r.hide_from_search) continue;
    const k = keys[i];
    const d = singular(k) === singular(key) ? 0 : distance(k, key, max);
    if (d <= max && (!best || d < best.d)) best = { row: r, d };
  }
  return best?.row ?? null;
}

// "4" and "four" are one word: "4 gin" finds Four Pillars, "four pines" finds 4 Pines.
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const numberTwin = (w: string): string | null => {
  const n = NUMBER_WORDS.indexOf(w);
  return n >= 0 ? String(n) : (NUMBER_WORDS[Number(w)] ?? null);
};

/** Every typed word starts a word of the name (`own`), in any order ("fords gin", "gin four"). */
function hasEveryWord(own: readonly string[], words: readonly { w: string; twin: string | null }[]): boolean {
  return words.every(({ w, twin }) => own.some((o) => o.startsWith(w) || (twin !== null && o === twin) || numberTwin(o)?.startsWith(w)));
}

/**
 * Ingredients for what's typed: the one it already is (by name or alias)
 * first, then core ingredients, then the rest; names that start with it
 * before ones that contain it, then ones with every typed word in any order
 * ("4 gin" finds Four Pillars Navy Strength Gin). One-off bottles and preps
 * hidden from search only show when typed in full.
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
  const words = q.split(' ').map((w) => ({ w, twin: numberTwin(w) }));
  // One plain word is already found by "contains"; more words, or a number, need the word check.
  const byWord = words.length > 1 || words.some((x) => x.twin !== null);
  const index = indexOf(rows);
  const own = byWord ? wordsOf(index) : [];
  const scored: { r: T; s: number }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r === same) continue;
    const k = index.keys[i];
    const starts = k.startsWith(q) || aliasHits.has(r.id);
    const contains = !starts && k.includes(q);
    const every = !starts && !contains && byWord && hasEveryWord(own[i], words);
    if (!starts && !contains && !every) continue;
    if (r.hide_from_search && k !== q) continue;
    // Lower is better: start before contain before every word, core before the rest, then shorter.
    scored.push({ r, s: (starts ? 0 : contains ? 2 : 4) + (coreIds.has(r.id) ? 0 : 1) });
  }
  scored.sort((a, b) => a.s - b.s || (a.r.name ?? '').length - (b.r.name ?? '').length);
  return [...(same ? [same] : []), ...scored.map((x) => x.r)].slice(0, limit);
}

/** A row that can say what kind it is: a bottle (`product`) under a style (`generic_id`). */
export interface KindRow extends IngredientRow {
  generic_id?: string | null;
  ingredient_role?: string | null;
  brand_maker?: string | null;
}

/** A bottle you can buy: a product, or an unsorted row with a maker on it. */
const isBottle = (r: KindRow) => r.ingredient_role === 'product' || (!r.ingredient_role && !!r.brand_maker);

/**
 * The bottles of a kind, for "Pick a brand": every bottle under it, through
 * its styles too (Mezcal's Espadín and Tobalá), the ones you have first
 * (`have`: the back bar or the shelf), then by name. Hidden one-offs are left
 * out. A bottle typed is not a kind, so it has none.
 */
export function bottlesOfKind<T extends KindRow>(kind: T, rows: readonly T[], have: ReadonlySet<string> = new Set()): T[] {
  if (isBottle(kind)) return [];
  const index = indexOf(rows);
  const under = (index.under ??= kindsOf(rows));
  const seen = new Set([kind.id]);
  const queue = [kind.id];
  const out: T[] = [];
  while (queue.length) {
    for (const r of under.get(queue.shift() as string) ?? []) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      queue.push(r.id);
      if (isBottle(r) && !r.hide_from_search && r.name) out.push(r);
    }
  }
  return out.sort((a, b) => Number(have.has(b.id)) - Number(have.has(a.id)) || (a.name ?? '').localeCompare(b.name ?? ''));
}

/** Each kind's rows (generic_id), in the list's order. */
function kindsOf<T extends KindRow>(rows: readonly T[]): Map<string, T[]> {
  const under = new Map<string, T[]>();
  for (const r of rows) {
    if (!r.generic_id) continue;
    const list = under.get(r.generic_id);
    if (list) list.push(r);
    else under.set(r.generic_id, [r]);
  }
  return under;
}

/** A kind as a sentence says it: "mezcal", "mezcals". Longer names stay as they are ("Irish whiskey", "London Dry Gin"). */
export function kindWords(name: string, many = false): string {
  const n = /^[A-Z][a-z]+$/.test(name) ? name.toLowerCase() : name;
  if (!many || /s$/i.test(n)) return n;
  return /[^aeiou]y$/i.test(n) ? `${n.slice(0, -1)}ies` : `${n}s`;
}

// Words a made thing's name ends on: they say what it is, not what's in it.
const KIND_WORD = /^(shrub|syrup|cordial|oleo|infusion|infused|tincture|bitters|foam|oil|juice|soda|water|batch|mix|cream|liqueur|of|and|with|the|house)$/;

/**
 * The ingredients closest to a name nothing matches ("pineapple chili shrub"
 * → Pineapple juice): those sharing the most of its flavour words (the
 * first, usually the base, weighing most), core ones first, then shorter names. Hidden rows and rows in `skip` are left out.
 */
export function closestIngredients<T extends IngredientRow>(
  query: string,
  rows: readonly T[],
  opts: { coreIds?: ReadonlySet<string>; skip?: readonly T[]; limit?: number } = {}
): T[] {
  const { coreIds = new Set<string>(), skip = [], limit = 3 } = opts;
  const words = ingredientKey(query).split(' ').filter((w) => w.length >= 3 && !KIND_WORD.test(w));
  if (!words.length) return [];
  const all = wordsOf(indexOf(rows));
  const scored: { r: T; shared: number }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.hide_from_search || skip.includes(r)) continue;
    const own = all[i];
    // The first word is usually the base ("pineapple" in a pineapple chili shrub): it weighs most.
    const shared = words.reduce((n, w, at) => (own.includes(w) ? n + words.length - at : n), 0);
    if (shared) scored.push({ r, shared });
  }
  scored.sort(
    (a, b) =>
      b.shared - a.shared || Number(coreIds.has(b.r.id)) - Number(coreIds.has(a.r.id)) || (a.r.name ?? '').length - (b.r.name ?? '').length
  );
  return scored.slice(0, limit).map((x) => x.r);
}

/** The id the database pointed at when it refused a copy (its hint), if any. */
export function existingIngredientId(error: unknown): string | null {
  const e = error as { code?: string; hint?: string | null } | null;
  return e?.code === 'P0001' && e.hint && /^[0-9a-f-]{36}$/i.test(e.hint) ? e.hint : null;
}
