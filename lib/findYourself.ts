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
  origin_bar_profile_id: string | null;
}

export interface JobRow {
  bar_profile_id: string;
  person_profile_id: string;
  is_current: boolean;
  is_shown: boolean;
  is_hidden: boolean;
}

/**
 * Counts per profile id: each drink once per profile that made it (alone or
 * with others) or where it was first made, and a bar's people the way its
 * page counts them (current, or a past job they show). Plain JSON for the
 * persisted cache.
 */
export function countWaiting(ids: readonly string[], drinks: readonly CreditRow[], coCreators: readonly { item_id: string; profile_id: string }[], jobs: readonly JobRow[], claimed: ReadonlySet<string>): Record<string, Waiting> {
  const drinkSets = new Map(ids.map((id) => [id, new Set<string>()]));
  const peopleSets = new Map(ids.map((id) => [id, new Set<string>()]));
  for (const d of drinks) {
    for (const p of [d.creator_profile_id, d.origin_bar_profile_id]) if (p) drinkSets.get(p)?.add(d.id);
  }
  for (const c of coCreators) drinkSets.get(c.profile_id)?.add(c.item_id);
  for (const j of jobs) if (!j.is_hidden && (j.is_current || j.is_shown)) peopleSets.get(j.bar_profile_id)?.add(j.person_profile_id);
  return Object.fromEntries(ids.map((id) => [id, { drinks: drinkSets.get(id)!.size, people: peopleSets.get(id)!.size, claimed: claimed.has(id) }]));
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
