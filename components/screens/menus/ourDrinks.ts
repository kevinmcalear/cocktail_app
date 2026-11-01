// Our drinks (2027 canvas, Menu-l-drinks and Menu-l-back-sheet; decision
// page, repertoire: "A place of its own"): every drink the bar has had on a
// list, each with its dated runs, and Bring back for one that left. Kept pure:
// the screen and the sheet wire the reads and the taps.
import type { ListDates, Repertoire, RepertoireDrink } from '@/lib/repertoire';

import { runRange } from './page/liveList';

export type OurDrinksFilter = 'all' | 'past' | 'on';

/** On now, the board's first rows before "5 more on now". */
export const ON_NOW_SHOWN = 3;

const DAY = 86_400_000;
const monthYear = (year: number, month: number | null) => new Date(year, (month ?? 1) - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
const monthOnly = (month: number | null) => new Date(2000, (month ?? 1) - 1, 1).toLocaleDateString(undefined, { month: 'short' });

/**
 * When one run was: "1 Oct to 1 Nov 2026", "Mar to May 2025" (research
 * history is known to the month), "since 12 Oct 2026" while on, or "since
 * Mar 2025" once it has been on half a year. Null when nobody knows.
 */
export function runWhen(r: ListDates, now: number): string | null {
  if (r.isCurrent) {
    const recent = r.startsOn && now - Date.parse(`${r.startsOn}T00:00`) < 183 * DAY;
    // The same day format as a run's range ("Nov 1 2026"), not the locale's "Nov 1, 2026".
    const since = recent
      ? runRange(r.startsOn!, r.startsOn!, true)
      : r.startYear
        ? monthYear(r.startYear, r.startMonth)
        : null;
    return since ? `since ${since}` : null;
  }
  if (r.startsOn && r.endsOn) return runRange(r.startsOn, r.endsOn, true);
  if (!r.startYear) return null;
  if (!r.endYear) return monthYear(r.startYear, r.startMonth);
  if (r.startYear === r.endYear && r.startMonth === r.endMonth) return monthYear(r.endYear, r.endMonth);
  return r.startYear === r.endYear
    ? `${monthOnly(r.startMonth)} to ${monthYear(r.endYear, r.endMonth)}`
    : `${monthYear(r.startYear, r.startMonth)} to ${monthYear(r.endYear, r.endMonth)}`;
}

/** One run's line on Our drinks: "Cocktails · 1 Oct to 1 Nov 2026". */
export function runLine(r: ListDates, now: number): string {
  const when = runWhen(r, now);
  return when ? `${r.listName} · ${when}` : r.listName;
}

/** The first month any of these drinks went on a list, "Mar 2025", for the eyebrow. */
export function firstOn(drinks: RepertoireDrink<unknown>[]): string | null {
  let best: { y: number; m: number } | null = null;
  for (const d of drinks)
    for (const r of d.dates) {
      const y = r.startYear ?? (r.startsOn ? Number(r.startsOn.slice(0, 4)) : null);
      const m = r.startMonth ?? (r.startsOn ? Number(r.startsOn.slice(5, 7)) : 1);
      if (y && (!best || y < best.y || (y === best.y && m < best.m))) best = { y, m };
    }
  return best ? monthYear(best.y, best.m) : null;
}

/** "Little Rye · 31 drinks since Mar 2025". */
export function ourDrinksEyebrow(bar: string, rep: Repertoire<unknown>): string {
  const all = [...rep.past, ...rep.onNow];
  const since = firstOn(all);
  return [bar, `${all.length} ${all.length === 1 ? 'drink' : 'drinks'}${since ? ` since ${since}` : ''}`].filter(Boolean).join(' · ');
}

/** What the filter and search leave: Off the list (newest first) and On now. */
export function shownGroups<D extends { name: string }>(rep: Repertoire<D>, filter: OurDrinksFilter, query: string) {
  const q = query.trim().toLowerCase();
  const match = (d: RepertoireDrink<D>) => !q || d.drink.name.toLowerCase().includes(q);
  return {
    past: filter === 'on' ? [] : rep.past.filter(match),
    onNow: filter === 'past' ? [] : rep.onNow.filter(match),
  };
}

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
const COUNTS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/**
 * Under Bring back: "A third run starts today. The first two stay on its
 * page." `when`: "today", "after tonight", "on 5 Nov".
 */
export function bringBackNote(runs: number, when: string, asking: boolean): string {
  const nth = ORDINALS[runs];
  const starts = `${nth ? `A ${nth} run` : 'Another run'} starts ${when}.`;
  const kept = runs === 1 ? 'Its first run stays on its page.' : `The first ${COUNTS[runs] ?? runs} stay on its page.`;
  return asking ? `It waits for approval. ${kept}` : `${starts} ${kept}`;
}
