/**
 * The words and the current row for the app's shell: the desktop sidebar, the
 * tablet rail and the phone's venue menu. Pure, so lib/shellNav.check.ts can
 * run it without React.
 */

import { layout } from '@/constants/tokens';

/**
 * Which nav the shell shows: the phone tab bar, the tablet icon rail (768 to
 * 1199) or the desktop sidebar. The web and a native iPad (`pad`, decided
 * 24 Oct 2026) go wide; iPhone and Android keep the tab bar.
 */
export type WebNav = 'tabs' | 'rail' | 'sidebar';

export function webNavFor(os: string, width: number, pad = false): WebNav {
  if ((os !== 'web' && !pad) || width < layout.breakpoints.tablet) return 'tabs';
  return width < layout.breakpoints.desktop ? 'rail' : 'sidebar';
}

/** A nav row and the paths that count as being on it. */
export interface NavMatch {
  key: string;
  /** The row's own path, matched exactly ('/' is Tonight). */
  path: string;
  /** Paths under the row that also count (Menus covers /menus/<id>/edit). */
  prefix?: string;
}

function matches(pathname: string, row: NavMatch): boolean {
  if (pathname === row.path) return true;
  return !!row.prefix && (pathname === row.prefix || pathname.startsWith(`${row.prefix}/`));
}

/**
 * Which row is current. A page that isn't a nav row (a drink, the add wizard)
 * keeps the row it was opened from lit, so you can see where you are: pass the
 * last current key as `last`. Returns the new current key, which is also the
 * next `last`.
 */
export function navCurrent(pathname: string, rows: readonly NavMatch[], last: string | null): string | null {
  const hit = rows.find((r) => matches(pathname, r));
  if (hit) return hit.key;
  return rows.some((r) => r.key === last) ? last : null;
}

/** "Kevin McAlear" to "Kevin M.": first name and the last name's initial, for the sidebar footer. */
export function shortPersonName(full: string | null | undefined): string {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'You';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The footer's second line: "Admin at Little Rye", or "Home bar · 46 bottles" at home. */
export function footerLine(venue: { name: string; role: string } | null, bottles: number | null): string {
  if (venue) return `${venue.role} at ${venue.name}`;
  return bottles ? `Home bar · ${plural(bottles, 'bottle')}` : 'Home bar';
}

// The venue menu's live counts, on the right of each row: short, and empty when there's nothing to count.

/** Menus: "1 on", or "2 drafts" when none is on. */
export function menusLine(on: number, drafts: number): string {
  if (on) return `${on} on`;
  return drafts ? plural(drafts, 'draft') : '';
}

/** Back bar: what waits for a spot first, else how many are placed. */
export function backBarLine(placed: number, waiting: number): string {
  if (waiting) return `${waiting} waiting`;
  return placed ? `${placed} placed` : '';
}

/** My team: "9 people · 2 invited". */
export function teamLine(people: number, invited: number): string {
  return [plural(people, 'person', 'people'), invited ? `${invited} invited` : null].filter(Boolean).join(' · ');
}

/** My Bar: "4 bottles". */
export function shelfLine(bottles: number): string {
  return bottles ? plural(bottles, 'bottle') : '';
}

/** Collection: "12 to make". */
export function collectionLine(toMake: number): string {
  return toMake ? `${toMake} to make` : '';
}

/** Features: "2 of 8 on". */
export function featuresLine(on: number, of: number): string {
  return on ? `${on} of ${of} on` : '';
}
