// A bar's whole repertoire (decision page, repertoire: "yes"; canvas
// Menu-l-drinks, "Our drinks"): every drink it has, sorted by where it is
// now. A drink that left keeps its dates on the list and can come back.

export interface ListDates {
  itemId: string;
  /** The list it was on ("Autumn", "Specials"). */
  listName: string;
  /** Day it went on; null when only the month is known (research history). */
  startsOn: string | null;
  endsOn: string | null;
  /** Known to the month only (research history): the year and month it went on and came off. */
  startYear: number | null;
  startMonth: number | null;
  endYear: number | null;
  endMonth: number | null;
  isCurrent: boolean;
}

export interface RepertoireDrink<D> {
  drink: D;
  dates: ListDates[];
  /** The latest day it came off, for "Left 30 Sep". */
  leftOn: string | null;
}

export interface Repertoire<D> {
  onNow: RepertoireDrink<D>[];
  /** Was on a list, isn't now: these can come back, the most recent first. */
  past: RepertoireDrink<D>[];
  /** Never on a list: house drinks, R&D, classics it makes. */
  never: RepertoireDrink<D>[];
}

/** Splits a bar's drinks into on now, past (with their dates) and never on a list. */
export function repertoire<D extends { id: string }>(drinks: D[], dates: ListDates[]): Repertoire<D> {
  const out: Repertoire<D> = { onNow: [], past: [], never: [] };
  for (const drink of drinks) {
    const mine = dates.filter((d) => d.itemId === drink.id).sort((a, b) => (b.startsOn ?? '').localeCompare(a.startsOn ?? ''));
    const ends = mine.map((d) => d.endsOn).filter((e): e is string => !!e).sort();
    const entry = { drink, dates: mine, leftOn: ends.length ? ends[ends.length - 1] : null };
    if (mine.some((d) => d.isCurrent)) out.onNow.push(entry);
    else if (mine.length) out.past.push(entry);
    else out.never.push(entry);
  }
  out.past.sort((a, b) => (b.leftOn ?? '').localeCompare(a.leftOn ?? ''));
  return out;
}
