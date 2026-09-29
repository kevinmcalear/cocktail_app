/** A bar's placing or award, as stored in profile_accolades. */
export interface Accolade {
  id: string;
  award: string;
  year: number;
  position: number | null;
  title: string | null;
  source_url: string | null;
}

/** One cocktail menu a bar put out, as stored in profile_menu_editions. */
export interface MenuEdition {
  id: string;
  name: string;
  year: number;
  month: number | null;
  theme: string | null;
  drinks: string[];
  source_url: string | null;
}

export interface AwardGroup {
  award: string;
  /** Newest first: "2025 · No. 1", "2025 · Best International Cocktail Bar". */
  entries: { key: string; year: number; label: string }[];
  /** The best position ever reached on this list, if it's a ranked list. */
  best: number | null;
}

/**
 * Accolades by award, newest year first within each. Awards with the most
 * entries lead (a bar's longest run shows first), ties by name. Within a
 * year a placing comes before named awards.
 */
export function groupAccolades(rows: Accolade[]): AwardGroup[] {
  const byAward = new Map<string, Accolade[]>();
  for (const row of rows) byAward.set(row.award, [...(byAward.get(row.award) ?? []), row]);
  return [...byAward.entries()]
    .map(([award, list]) => {
      const sorted = [...list].sort(
        (a, b) => b.year - a.year || Number(a.position === null) - Number(b.position === null) || (a.position ?? 0) - (b.position ?? 0) || (a.title ?? '').localeCompare(b.title ?? '')
      );
      const positions = list.map((r) => r.position).filter((p): p is number => p !== null);
      return {
        award,
        entries: sorted.map((r) => ({ key: r.id, year: r.year, label: r.position !== null ? `No. ${r.position}` : r.title ?? '' })),
        best: positions.length ? Math.min(...positions) : null,
      };
    })
    .sort((a, b) => b.entries.length - a.entries.length || a.award.localeCompare(b.award));
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "May 2023", or "2023" when the month isn't known. */
export function menuDate(edition: Pick<MenuEdition, 'year' | 'month'>): string {
  return edition.month ? `${MONTHS[edition.month - 1]} ${edition.year}` : String(edition.year);
}

/** Newest menu first; a menu with only a year sorts after the dated ones that year. */
export function sortEditions<T extends Pick<MenuEdition, 'year' | 'month' | 'name'>>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.year - a.year || (b.month ?? 0) - (a.month ?? 0) || a.name.localeCompare(b.name));
}
