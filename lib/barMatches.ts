// What my_bar_drinks returns, sorted into My Bar's lists: drinks the shelf
// makes, drinks one bottle away grouped by the bottle, drinks two away grouped
// by the pair, and how many ready drinks each shelf row goes into.

/** A row of my_bar_drinks (supabase/migrations/20261009950000_my_bar_kinds.sql). */
export interface MatchRow {
  id: string;
  name: string;
  image_url: string | null;
  glassware_id: string | null;
  /** What to buy, or null when the shelf already makes it. */
  missing_id: string | null;
  missing_name: string | null;
  /** The second thing to buy, for drinks two away. */
  missing2_id?: string | null;
  missing2_name?: string | null;
  /** The shelf rows the drink uses. */
  uses?: string[] | null;
  /** The bar it's from, and its logo: null for catalog drinks (20261010500000). */
  from_name?: string | null;
  from_logo?: string | null;
}

export interface Buy {
  id: string;
  name: string;
}

export interface AwayGroup<T> {
  /** One bottle, or two for drinks two away, A to Z by id as the server sends them. */
  buy: Buy[];
  drinks: T[];
}

export interface SortedMatches<T> {
  canMake: T[];
  oneAway: AwayGroup<T>[];
  twoAway: AwayGroup<T>[];
  /** Shelf row id to the number of ready drinks it goes into. */
  usedIn: Record<string, number>;
}

/** Sorts rows into lists, each group's drinks in the rows' order (A to Z), the groups opening the most drinks first. */
export function sortMatches<T>(rows: MatchRow[], drink: (r: MatchRow) => T): SortedMatches<T> {
  const canMake: T[] = [];
  const usedIn: Record<string, number> = {};
  const groups = new Map<string, AwayGroup<T>>();
  for (const r of rows) {
    if (!r.missing_id) {
      canMake.push(drink(r));
      for (const id of r.uses ?? []) usedIn[id] = (usedIn[id] ?? 0) + 1;
      continue;
    }
    const buy = [{ id: r.missing_id, name: r.missing_name ?? '' }];
    if (r.missing2_id) buy.push({ id: r.missing2_id, name: r.missing2_name ?? '' });
    const key = buy.map((b) => b.id).join('+');
    const group = groups.get(key) ?? { buy, drinks: [] };
    group.drinks.push(drink(r));
    groups.set(key, group);
  }
  const key = (g: AwayGroup<T>) => g.buy.map((b) => b.id).join('+');
  const ranked = [...groups.values()].sort((a, b) => b.drinks.length - a.drinks.length || key(a).localeCompare(key(b)));
  return { canMake, oneAway: ranked.filter((g) => g.buy.length === 1), twoAway: ranked.filter((g) => g.buy.length === 2), usedIn };
}
