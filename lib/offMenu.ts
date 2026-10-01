/** How many drinks sit in each recommended band. One list, two lengths. */
export const TOP_10 = 10;
export const TOP_40 = 40;

export type Band = 'top10' | 'top40' | 'also';

export interface NamedPick {
  rank: number | null;
  name: string;
}

export interface OffMenuCandidate {
  id: string;
  name: string;
  classicName: string | null;
}

/** Top 10 is ranks 1–10, top 40 is 11–40, and no rank is the rest they can make. */
export function bandOf(rank: number | null): Band {
  if (rank != null && rank <= TOP_10) return 'top10';
  if (rank != null && rank <= TOP_40) return 'top40';
  return 'also';
}

/** The next free rank in a band, or null when that band is full. */
export function nextRank(ranks: readonly (number | null)[], band: 'top10' | 'top40'): number | null {
  const start = band === 'top10' ? 1 : TOP_10 + 1;
  const end = band === 'top10' ? TOP_10 : TOP_40;
  const taken = new Set(ranks);
  for (let n = start; n <= end; n++) if (!taken.has(n)) return n;
  return null;
}

/** The patron's three groups, each in the order to read them. */
export function patronGroups<T extends NamedPick>(rows: readonly T[]): { top10: T[]; top40: T[]; also: T[] } {
  const top10: T[] = [];
  const top40: T[] = [];
  const also: T[] = [];
  for (const row of rows) {
    const band = bandOf(row.rank);
    if (band === 'top10') top10.push(row);
    else if (band === 'top40') top40.push(row);
    else also.push(row);
  }
  top10.sort((a, b) => a.rank! - b.rank!);
  top40.sort((a, b) => a.rank! - b.rank!);
  also.sort((a, b) => a.name.localeCompare(b.name));
  return { top10, top40, also };
}

/**
 * What to offer while adding. The bar's own riffs come first, then catalog
 * classics. An empty query offers nothing, so the catalog isn't dumped on
 * the screen. ponytail: eight matches; raise the cap if search feels short.
 */
export function candidatesFor(
  riffs: readonly OffMenuCandidate[],
  classics: readonly { id: string; name: string }[],
  query: string,
  taken: ReadonlySet<string>,
): OffMenuCandidate[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const pool: OffMenuCandidate[] = [...riffs, ...classics.map((c) => ({ id: c.id, name: c.name, classicName: null }))];
  const seen = new Set<string>();
  const out: OffMenuCandidate[] = [];
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
