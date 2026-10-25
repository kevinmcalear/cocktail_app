/**
 * The steps "Set up <bar>" opens in place (lib/setupChecklist.ts): which 20
 * classics to offer, the glasses grouped the way the step lists them, the
 * glasses held until the page is checked, and the brands step's groups.
 */

/** How many classics the menu step offers. */
export const CLASSIC_COUNT = 20;

/**
 * The most ranked classics: most people ranking it first, then the order the
 * catalog already comes in (orderDrinks: best-known, then A to Z), so a young
 * app with few rankings still offers the drinks bars pour most. Missing
 * counts are 0.
 */
export function topClassics<T extends { id: string }>(catalog: readonly T[], rankers: Readonly<Record<string, number>>, n = CLASSIC_COUNT): T[] {
  const at = new Map(catalog.map((c, i) => [c.id, i]));
  return [...catalog].sort((a, b) => (rankers[b.id] ?? 0) - (rankers[a.id] ?? 0) || at.get(a.id)! - at.get(b.id)!).slice(0, n);
}

/** The ticked classics the bar doesn't have a copy of yet: what "Add N classics" adds. */
export function classicsToAdd<T extends { id: string }>(offered: readonly T[], unticked: ReadonlySet<string>, have: ReadonlySet<string>): T[] {
  return offered.filter((c) => !unticked.has(c.id) && !have.has(c.id));
}

/** A bar's drink that is already that classic: a version of it, or the same name. */
export function haveClassics(classics: readonly { id: string; name: string }[], drinks: readonly { name: string; riff_of_id: string | null }[]): Set<string> {
  const fold = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  const riffs = new Set(drinks.map((d) => d.riff_of_id).filter(Boolean));
  const names = new Set(drinks.map((d) => fold(d.name)));
  return new Set(classics.filter((c) => riffs.has(c.id) || names.has(fold(c.name))).map((c) => c.id));
}

export interface GlassGroup<T> {
  /** "Cocktail Kingdom · Leopold", or "Libbey" for a shape's list. */
  title: string;
  models: T[];
}

/**
 * Glasses in runs of the same maker (and range, for a search), in the order
 * they came: "Cocktail Kingdom · Leopold · 4" over its four.
 */
export function groupGlasses<T extends { series: string | null; maker: { display_name: string } | null }>(models: readonly T[], by: 'range' | 'maker'): GlassGroup<T>[] {
  const groups: GlassGroup<T>[] = [];
  for (const m of models) {
    const title = [m.maker?.display_name ?? 'Other makers', by === 'range' ? m.series : null].filter(Boolean).join(' · ');
    const last = groups[groups.length - 1];
    if (last?.title === title) last.models.push(m);
    else groups.push({ title, models: [m] });
  }
  return groups;
}

/**
 * Glasses held on the device before the venue's page was checked, as they
 * go onto the page: each catalog glass once (one already there is `skip`),
 * and the first of a type the main one when the page has no main glass of
 * that type yet.
 */
export function heldGlassPlan<T extends { key: string; glass: string; model_id?: string | null }>(
  held: readonly T[],
  onPage: readonly { glass: string; model_id: string | null; is_default: boolean }[]
): { save: (T & { is_default: boolean })[]; skip: string[] } {
  const models = new Set(onPage.map((g) => g.model_id).filter(Boolean));
  const mains = new Set(onPage.filter((g) => g.is_default).map((g) => g.glass));
  const save: (T & { is_default: boolean })[] = [];
  const skip: string[] = [];
  for (const g of held) {
    if (g.model_id && models.has(g.model_id)) {
      skip.push(g.key);
      continue;
    }
    if (g.model_id) models.add(g.model_id);
    save.push({ ...g, is_default: !mains.has(g.glass) });
    mains.add(g.glass);
  }
  return { save, skip };
}

/** Held glasses not on the page yet (a catalog glass saved there already counts once). */
export function heldNotOnPage<T extends { model_id?: string | null }>(held: readonly T[], onPage: readonly { model_id: string | null }[]): T[] {
  return held.filter((h) => !h.model_id || !onPage.some((g) => g.model_id === h.model_id));
}

/**
 * The kinds the brands step starts from, as drawn (owner setup step 8, call
 * 10): a whole back bar, one chip each. Vermouth covers sweet and dry; a
 * bitter aperitivo sits under Liqueur.
 */
export const BRAND_GROUPS: readonly { title: string; kinds: readonly string[] }[] = [
  { title: 'Gin', kinds: ['Gin'] },
  { title: 'Vodka', kinds: ['Vodka'] },
  { title: 'Rum', kinds: ['Rum'] },
  { title: 'Tequila', kinds: ['Tequila'] },
  { title: 'Mezcal', kinds: ['Mezcal'] },
  { title: 'Whiskey', kinds: ['Whiskey'] },
  { title: 'Brandy', kinds: ['Brandy'] },
  { title: 'Vermouth', kinds: ['Vermouth'] },
  { title: 'Amaro', kinds: ['Amaro'] },
  { title: 'Liqueur', kinds: ['Liqueur'] },
  { title: 'Bitters', kinds: ['Bitters'] },
  { title: 'Wine', kinds: ['Wine'] },
  { title: 'Beer', kinds: ['Beer'] },
  { title: 'Non-alcoholic', kinds: ['Non-alcoholic spirit'] },
];

/** "Any mezcal", "Any bitter aperitivo": the plain thing, when the brand doesn't matter. */
export const anyKind = (name: string) => `Any ${name.charAt(0).toLowerCase()}${name.slice(1)}`;

export interface BrandGroup<T> {
  title: string;
  /** The plain things ("Any mezcal"), tapped when the brand doesn't matter. */
  kinds: T[];
  /** What's on the back bar under it that isn't one of `kinds`. */
  picked: T[];
}

/**
 * The brands step's groups: the starting kinds (each with what's on the back
 * bar under it, however deep: Del Maguey Vida is an espadín, which is a
 * mezcal), then anything else on the back bar under its own top kind (a
 * lager under Beer), in the order it came.
 */
export function brandGroups<T extends { id: string; name: string | null; generic_id?: string | null; ingredient_role?: string | null }>(
  ingredients: readonly T[],
  stocked: readonly string[],
  starts: readonly { title: string; kinds: readonly string[] }[] = BRAND_GROUPS
): BrandGroup<T>[] {
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const fold = (s: string | null) => (s ?? '').trim().toLowerCase();
  // A kind by its name; when two rows share one (a stray "Amaro" beside the real kind), the generic wins.
  const kindByName = new Map<string, T>();
  for (const i of ingredients) {
    if (i.ingredient_role === 'product') continue;
    const had = kindByName.get(fold(i.name));
    if (!had || (had.ingredient_role !== 'generic' && i.ingredient_role === 'generic')) kindByName.set(fold(i.name), i);
  }
  const groups: BrandGroup<T>[] = starts.map((s) => ({ title: s.title, kinds: s.kinds.map((k) => kindByName.get(fold(k))).filter((k): k is T => !!k), picked: [] }));
  const groupOf = new Map<string, BrandGroup<T>>();
  for (const g of groups) for (const k of g.kinds) groupOf.set(k.id, g);
  const up = (i: T) => (i.generic_id ? byId.get(i.generic_id) : undefined);
  for (const id of stocked) {
    const item = byId.get(id);
    if (!item) continue;
    // Up the kinds to a starting one, else to the top (ten deep at most: a loop in the data stops there).
    let top = item;
    let home = groupOf.get(item.id);
    for (let k = up(item), n = 0; k && !home && n < 10; k = up(k), n++) {
      top = k;
      home = groupOf.get(k.id);
    }
    if (!home) {
      home = { title: top.name ?? '', kinds: top === item ? [] : [top], picked: [] };
      groups.push(home);
      groupOf.set(top.id, home);
    }
    if (!home.kinds.includes(item) && !home.picked.includes(item)) home.picked.push(item);
  }
  return groups.filter((g) => g.kinds.length || g.picked.length);
}
