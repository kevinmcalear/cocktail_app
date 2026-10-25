/**
 * What a venue's search rows say about why each is here (nav-search-venue):
 * "On the Autumn menu · Classics 4", a "Past · Mar 2024 to Jan 2025" pill,
 * "In 6 drinks", "Prep · in 1 drink", "On now · 2 of these drinks". Pure;
 * checked by lib/searchCaptions.check.ts.
 */
import { menuRange } from './menuEditions';
import { groupMenus } from './menus';
import type { MenuSummary } from '@/types/menus';

export interface MineFacts {
  /** The venue's menus (not R&D), any state. */
  menus: MenuSummary[];
  now: number;
  /** The staff list's ranked drink ids, best first. */
  staff: string[];
  /** On the staff list without a place yet (past the 50 ranks). */
  unranked?: readonly string[];
  /** Each ingredient id, and the drinks (ids) whose specs use it. */
  usedIn: ReadonlyMap<string, readonly string[]>;
  /** The venue's house preps. */
  preps: ReadonlySet<string>;
}

/** "Autumn menu" stays; "Autumn" becomes "Autumn menu". */
const menuName = (name: string) => (/\bmenu$/i.test(name.trim()) ? name.trim() : `${name.trim()} menu`);

function monthOf(iso: string | null): { year: number; month: number } | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/**
 * A drink's caption and pill: the menu it's on now and its staff list place ("off menu" when on none), else its kind; "Past · …" when it only was.
 * `years`: the pill gives years only ("Past · 2024"), for the tablet's narrow list (nav-tablet).
 */
export function drinkFacts(id: string, kind: string, facts: MineFacts, years = false): { caption: string; tag?: string } {
  const groups = groupMenus(facts.menus, facts.now);
  const on = groups.on.filter((m) => m.itemIds.includes(id)).map((m) => `On the ${menuName(m.name)}`);
  const at = facts.staff.indexOf(id);
  // A Classics drink that isn't on a menu says so: "Classics 2 · off menu" (nav-tablet, the palette).
  // An unranked pick is on the list without a place: "Classics · off menu".
  const listed = at >= 0 ? `Classics ${at + 1}` : facts.unranked?.includes(id) ? 'Classics' : null;
  const staff = listed && !on.length ? `${listed} · off menu` : listed;
  const caption = [...on.slice(0, 1), staff].filter(Boolean).join(' · ') || kind;
  if (on.length) return { caption };
  const before = groups.previous.filter((m) => m.itemIds.includes(id));
  if (!before.length) return { caption };
  const starts = before.map((m) => monthOf(m.startsAt)).filter((d): d is NonNullable<typeof d> => !!d).sort((a, b) => a.year - b.year || a.month - b.month);
  const ends = before.map((m) => monthOf(m.endsAt)).filter((d): d is NonNullable<typeof d> => !!d).sort((a, b) => b.year - a.year || b.month - a.month);
  if (!starts.length) return { caption, tag: 'Past' };
  if (years) {
    const last = ends[0]?.year ?? starts[0].year;
    return { caption, tag: `Past · ${last === starts[0].year ? last : `${starts[0].year} to ${last}`}` };
  }
  return { caption, tag: `Past · ${menuRange({ startYear: starts[0].year, startMonth: starts[0].month, endYear: ends[0]?.year ?? starts[0].year, endMonth: ends[0]?.month ?? null, isCurrent: false })}` };
}

/** "In 6 drinks", or "House-made · in 1 drink" for something made in-house; nothing when no drink uses it. */
export function ingredientFacts(id: string, facts: MineFacts): string | undefined {
  const n = facts.usedIn.get(id)?.length ?? 0;
  const count = n ? `${n} ${n === 1 ? 'drink' : 'drinks'}` : null;
  if (facts.preps.has(id)) return count ? `House-made · in ${count}` : 'House-made';
  return count ? `In ${count}` : undefined;
}

/** "On now · 2 of these drinks": whether a menu is on, and how many of the drinks found are on it. */
export function menuFacts(menuId: string, foundIds: readonly string[], facts: MineFacts): string | undefined {
  const menu = facts.menus.find((m) => m.id === menuId);
  if (!menu) return undefined;
  const groups = groupMenus([menu], facts.now);
  const state = groups.on.length ? 'On now' : groups.upcoming.length ? 'Coming up' : groups.previous.length ? 'Past' : groups.rnd.length ? 'R&D' : null;
  const n = foundIds.filter((id) => menu.itemIds.includes(id)).length;
  return [state, n ? `${n} of these drinks` : null].filter(Boolean).join(' · ') || undefined;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** When something was opened, in day words: "just now", "2 hours ago", "yesterday", "Monday", "3 Oct". */
export function friendlyWhen(at: number, now: number): string {
  const mins = Math.max(0, Math.floor((now - at) / 60000));
  const then = new Date(at);
  const today = new Date(now);
  const days = Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime()) / 86400000);
  if (days <= 0) {
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} ${mins === 1 ? 'minute' : 'minutes'} ago`;
    const hours = Math.floor(mins / 60);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }
  if (days === 1) return 'yesterday';
  if (days < 7) return DAYS[then.getDay()];
  return `${then.getDate()} ${MONTHS[then.getMonth()]}`;
}
