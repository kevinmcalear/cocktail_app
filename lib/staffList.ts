/**
 * The staff list: the venue's drinks to know and suggest, ranked 1 to 50
 * (bar_off_menu.sort_rank), with cut lines after 10 and 20. A drink with no
 * rank is on the list but not in the ranking.
 */
export const CUTS = [10, 20] as const;
export const STAFF_LIST_MAX = 50;

export interface NamedPick {
  rank: number | null;
  name: string;
}

export interface StaffListCandidate {
  id: string;
  name: string;
  classicName: string | null;
}

export interface ClassicRow {
  itemId: string;
  rank: number | null;
  name: string;
  classicName: string | null;
  imageUrl: string | null;
  /** On the staff list (bar_off_menu); false for a drink that is only linked to a classic. */
  onList: boolean;
}

/**
 * Library's Classics (E50, 26 Oct 2026): the staff list, then every other
 * drink here linked to a classic, unranked. Its length is the Classics count.
 */
export function classicRows(picks: readonly Omit<ClassicRow, 'onList'>[], linked: readonly StaffListCandidate[]): ClassicRow[] {
  const on = new Set(picks.map((p) => p.itemId));
  const rest = linked.filter((c) => !on.has(c.id)).map((c) => ({ itemId: c.id, rank: null, name: c.name, classicName: c.classicName, imageUrl: null, onList: false }));
  return [...picks.map((p) => ({ ...p, onList: true })), ...rest];
}

/** Ranked drinks in rank order, then the unranked ones A to Z. */
export function staffOrder<T extends NamedPick>(rows: readonly T[]): { ranked: T[]; unranked: T[] } {
  const ranked = rows.filter((r) => r.rank != null).sort((a, b) => a.rank! - b.rank!);
  const unranked = rows.filter((r) => r.rank == null).sort((a, b) => a.name.localeCompare(b.name));
  return { ranked, unranked };
}

/** The patron's groups on a bar's public page: top 10, the rest of the top 50, and the others. */
export function patronGroups<T extends NamedPick>(rows: readonly T[]): { top10: T[]; top50: T[]; also: T[] } {
  const { ranked, unranked } = staffOrder(rows);
  return { top10: ranked.filter((r) => r.rank! <= CUTS[0]), top50: ranked.filter((r) => r.rank! > CUTS[0]), also: unranked };
}

/** The rank a newly added drink takes: the end of the ranking, or none when 50 is taken. */
export function appendRank(ranks: readonly (number | null)[]): number | null {
  const last = Math.max(0, ...ranks.filter((r): r is number => r != null));
  return last < STAFF_LIST_MAX ? last + 1 : null;
}

/** The ranked ids with one moved up (-1) or down (+1). Unchanged at either end. */
export function moved(ids: readonly string[], id: string, by: -1 | 1): string[] {
  const from = ids.indexOf(id);
  const to = from + by;
  if (from < 0 || to < 0 || to >= ids.length) return [...ids];
  const next = [...ids];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** The ranked ids with an unranked drink added at the end, or null when the ranking is full. */
export function ranked(ids: readonly string[], id: string): string[] | null {
  if (ids.includes(id)) return [...ids];
  return ids.length < STAFF_LIST_MAX ? [...ids, id] : null;
}

/** The ranked ids without one: it stays on the list, unranked. */
export function unranked(ids: readonly string[], id: string): string[] {
  return ids.filter((x) => x !== id);
}

/**
 * What to offer while adding. The bar's own riffs come first, then catalog
 * classics. An empty query offers nothing, so the catalog isn't dumped on
 * the screen. ponytail: eight matches; raise the cap if search feels short.
 */
export function candidatesFor(
  riffs: readonly StaffListCandidate[],
  classics: readonly { id: string; name: string }[],
  query: string,
  taken: ReadonlySet<string>,
): StaffListCandidate[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const pool: StaffListCandidate[] = [...riffs, ...classics.map((c) => ({ id: c.id, name: c.name, classicName: null }))];
  const seen = new Set<string>();
  const out: StaffListCandidate[] = [];
  for (const c of pool) {
    if (taken.has(c.id) || seen.has(c.id)) continue;
    const hay = `${c.name} ${c.classicName ?? ''}`.toLowerCase();
    if (!hay.includes(q)) continue;
    seen.add(c.id);
    out.push(c);
    if (out.length === 8) break;
  }
  return out;
}

/** Where the ranked rows stop in a dragged list: the "Not ranked" line. */
export const NOT_RANKED = '--not-ranked--';

/**
 * The ranking after a drag over the whole list, ranked rows then the "Not
 * ranked" line then the rest: everything above the line is ranked, in order,
 * up to the cap. Drag a Not ranked drink above the line to rank it.
 */
export function rankedAbove(order: readonly string[]): string[] {
  const line = order.indexOf(NOT_RANKED);
  return (line < 0 ? order : order.slice(0, line)).slice(0, STAFF_LIST_MAX);
}
