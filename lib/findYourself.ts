/**
 * Find yourself (the whole-app canvas, find-yourself board): a bartender
 * searches their bar or their name, sees what is already credited to them
 * and claims it. Pure helpers; queries are in hooks/useProfiles.ts. Checked
 * by lib/findYourself.check.ts.
 */

import { joinNames } from './lineage';
import { menuName } from './menuEditions';
import { plural } from './menus';

/** What a bar or person row says is waiting: drinks credited, a bar's people, and whether anyone has claimed the page. */
export interface Waiting {
  drinks: number;
  people: number;
  claimed: boolean;
}

export interface CreditRow {
  id: string;
  creator_profile_id: string | null;
}

export interface JobRow {
  bar_profile_id: string;
  person_profile_id: string;
  is_current: boolean;
  is_shown: boolean;
  is_hidden: boolean;
}

/**
 * Counts per profile id: a person's drinks once each, made alone or with
 * others; a bar's drinks first made there (counted by the server, in
 * barDrinks); a bar's people the way its page counts them (current, or a
 * past job they show). Plain JSON for the persisted cache.
 */
export function countWaiting(
  ids: readonly string[],
  personDrinks: readonly CreditRow[],
  coCreators: readonly { item_id: string; profile_id: string }[],
  jobs: readonly JobRow[],
  claimed: ReadonlySet<string>,
  barDrinks: Readonly<Record<string, number>> = {}
): Record<string, Waiting> {
  const drinkSets = new Map(ids.map((id) => [id, new Set<string>()]));
  const peopleSets = new Map(ids.map((id) => [id, new Set<string>()]));
  for (const d of personDrinks) if (d.creator_profile_id) drinkSets.get(d.creator_profile_id)?.add(d.id);
  for (const c of coCreators) drinkSets.get(c.profile_id)?.add(c.item_id);
  for (const j of jobs) if (!j.is_hidden && (j.is_current || j.is_shown)) peopleSets.get(j.bar_profile_id)?.add(j.person_profile_id);
  return Object.fromEntries(ids.map((id) => [id, { drinks: barDrinks[id] ?? drinkSets.get(id)!.size, people: peopleSets.get(id)!.size, claimed: claimed.has(id) }]));
}

/** "12 drinks · 4 people" for a bar, "5 drinks credited" for a person; null when nothing waits. */
export function waitingLine(kind: 'bar' | 'person', w: Pick<Waiting, 'drinks' | 'people'> | undefined): string | null {
  if (!w) return null;
  if (kind === 'person') return w.drinks ? `${plural(w.drinks, 'drink')} credited` : null;
  return [w.drinks ? plural(w.drinks, 'drink') : null, w.people ? plural(w.people, 'person', 'people') : null].filter(Boolean).join(' · ') || null;
}

/** "Pale Moth · Little Rye": where someone works and has worked, current first, no titles (decided 20 Oct). */
export function workedBars(jobs: readonly { is_current: boolean; bar: { display_name: string } | null }[], max = 2): string | null {
  const names = [...jobs].sort((a, b) => Number(b.is_current) - Number(a.is_current)).map((j) => j.bar?.display_name).filter((n): n is string => !!n);
  return [...new Set(names)].slice(0, max).join(' · ') || null;
}

// --- Made by (a person's page, find-yourself step 3) ---

/** A drink credited to the person: where it was first made, and who made it with them. */
export interface MadeDrink {
  id: string;
  name: string;
  barId: string | null;
  barName: string | null;
  /** The other makers' names: "with Sam Ortiz". */
  others: string[];
}

/** A menu a drink was on (menu_drink_runs). */
export interface DrinkRun {
  itemId: string;
  barId: string;
  editionId: string;
  editionName: string;
  startYear: number;
  endYear: number | null;
  isCurrent: boolean;
}

export interface MadeGroup {
  barId: string | null;
  barName: string | null;
  /** "Pale Moth · Night Garden, on now", "Little Rye · 2022 to 2024". */
  label: string;
  rows: { id: string; name: string; caption: string | null; onNow: boolean }[];
}

/** Where they worked, by bar: "2022 to 2024" (jobYears). */
export type JobYears = Readonly<Record<string, string | null>>;

/**
 * "Made by Ash": their drinks grouped by bar, the bar with a menu on now
 * first. A bar's label is its menu on now, else the years they worked there,
 * else the years its menus ran. Each drink says "On now" or its last menu
 * and year, after anyone it was made with.
 */
export function madeByGroups(drinks: readonly MadeDrink[], runs: readonly DrinkRun[], jobs: JobYears = {}): MadeGroup[] {
  const runsOf = new Map<string, DrinkRun[]>();
  for (const r of runs) runsOf.set(r.itemId, [...(runsOf.get(r.itemId) ?? []), r]);
  const groups = new Map<string, { barId: string | null; barName: string | null; drinks: MadeDrink[] }>();
  for (const d of drinks) {
    const key = d.barId ?? '';
    const g = groups.get(key) ?? { barId: d.barId, barName: d.barName, drinks: [] };
    g.drinks.push(d);
    groups.set(key, g);
  }
  const built = [...groups.values()].map((g) => {
    const barRuns = g.drinks.flatMap((d) => (runsOf.get(d.id) ?? []).filter((r) => !g.barId || r.barId === g.barId));
    const now = barRuns.find((r) => r.isCurrent);
    const years = barRuns.flatMap((r) => [r.startYear, r.endYear ?? r.startYear]);
    const span = years.length ? (Math.min(...years) === Math.max(...years) ? String(years[0]) : `${Math.min(...years)} to ${Math.max(...years)}`) : null;
    const when = now ? `${now.editionName}, on now` : ((g.barId && jobs[g.barId]) ?? span);
    const rows = g.drinks.map((d) => {
      const mine = (runsOf.get(d.id) ?? []).filter((r) => !g.barId || r.barId === g.barId);
      const on = mine.find((r) => r.isCurrent);
      const last = [...mine].sort((a, b) => (b.endYear ?? b.startYear) - (a.endYear ?? a.startYear))[0];
      const menu = on ? 'On now' : last ? `${menuName(last.editionName)} · ${last.startYear}` : null;
      return { id: d.id, name: d.name, onNow: !!on, caption: [d.others.length ? `with ${joinNames(d.others)}` : null, menu].filter(Boolean).join(' · ') || null };
    });
    rows.sort((a, b) => Number(b.onNow) - Number(a.onNow) || a.name.localeCompare(b.name));
    const latest = years.length ? Math.max(...years) : 0;
    return { group: { barId: g.barId, barName: g.barName, label: [g.barName ?? 'Other drinks', when].filter(Boolean).join(' · '), rows }, now: !!now, latest, unbarred: !g.barId };
  });
  built.sort((a, b) => Number(a.unbarred) - Number(b.unbarred) || Number(b.now) - Number(a.now) || b.latest - a.latest);
  return built.map((b) => b.group);
}

/**
 * "5 drinks credited", "2 bars", "2 menus": the numbers on an unclaimed
 * person's page. Bars count where they made drinks and where they worked
 * (`jobBars`), so "Worked at" two bars never sits under "0 bars".
 */
export function madeByStats(groups: readonly MadeGroup[], runs: readonly DrinkRun[], jobBars: readonly string[] = []): { drinks: number; bars: number; menus: number } {
  const ids = new Set(groups.flatMap((g) => g.rows.map((r) => r.id)));
  const bars = new Set([...groups.flatMap((g) => (g.barId ? [g.barId] : [])), ...jobBars]);
  return { drinks: ids.size, bars: bars.size, menus: new Set(runs.filter((r) => ids.has(r.itemId)).map((r) => r.editionId)).size };
}
