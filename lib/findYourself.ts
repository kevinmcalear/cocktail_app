/**
 * Find yourself (the whole-app canvas, find-yourself board): a bartender
 * searches their bar or their name, sees what is already credited to them
 * and claims it. Pure helpers; queries are in hooks/useProfiles.ts. Checked
 * by lib/findYourself.check.ts.
 */

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
