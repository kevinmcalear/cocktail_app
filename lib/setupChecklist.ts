/**
 * "Set up Little Rye" (board Kept-onboard, Owner after the three steps, 1 Nov
 * 2026): eight rows, three done by the end of venue setup, the rest whenever
 * the owner has a minute. Each row opens the app's own screen for it and comes
 * back here. Whether a row is done comes from the bar's own data; skips are
 * kept with the setup on the device. Calendars is optional, so it never holds
 * the list open. Checked by lib/setupChecklist.check.ts.
 */

import { faceFromDb } from './brand';

export const CHECKLIST_ROWS = [
  { key: 'claim', title: 'Claim it', line: 'Prove it’s yours', optional: false },
  { key: 'menu', title: 'Tonight’s menu', line: 'Start your own, or bring one in', optional: false },
  { key: 'where', title: 'Where and when', line: 'Your address and hours', optional: false },
  { key: 'glassware', title: 'Glassware from your drinks', line: '2 minutes', optional: false },
  { key: 'team', title: 'Invite your team', line: 'One link for everyone', optional: false },
  { key: 'visibility', title: 'Who sees your page', line: 'Menu, for now', optional: false },
  { key: 'theme', title: 'Theme', line: 'Your colour and your type', optional: false },
  { key: 'calendars', title: 'Calendars', line: 'Optional', optional: true },
] as const;

export type ChecklistKey = (typeof CHECKLIST_ROWS)[number]['key'];
export type RowState = 'done' | 'now' | 'todo' | 'skipped';

export interface Checklist {
  rows: { key: ChecklistKey; title: string; line: string; optional: boolean; state: RowState }[];
  done: number;
  total: number;
  /** The first row neither done nor skipped (an optional one only once the rest are). */
  next: ChecklistKey | null;
  /** Every row done or skipped, optional ones aside: the checklist leaves the top of the bar. */
  finished: boolean;
}

/** Skips kept by a setup from before 1 Nov: Kit was the glassware row. */
const OLD_SKIPS: Record<string, ChecklistKey> = { kit: 'glassware' };

/** Where each row stands, the first open one being "now". */
export function checklist(done: Readonly<Record<ChecklistKey, boolean>>, skipped: readonly string[] = []): Checklist {
  const skips = new Set(skipped.map((k) => OLD_SKIPS[k] ?? k));
  const open = CHECKLIST_ROWS.filter((r) => !done[r.key] && !skips.has(r.key));
  const next = (open.find((r) => !r.optional) ?? open[0])?.key ?? null;
  const rows = CHECKLIST_ROWS.map((r) => ({ ...r, state: (done[r.key] ? 'done' : r.key === next ? 'now' : skips.has(r.key) ? 'skipped' : 'todo') as RowState }));
  const count = rows.filter((r) => r.state === 'done').length;
  return { rows, done: count, total: rows.length, next, finished: open.every((r) => r.optional) };
}

/** "Owner · 3 of 8 done". */
export const checklistEyebrow = (list: Pick<Checklist, 'done' | 'total'>) => `Owner · ${list.done} of ${list.total} done`;

/** "Winter · 4 drinks". */
export const menuLine = (name: string, drinks: number) => `${name} · ${drinks} ${drinks === 1 ? 'drink' : 'drinks'}`;

/** Where and when is done once venue setup got past it (or, with no setup on this device, the bar was set up elsewhere). */
export function placeSet(run: { done: readonly string[]; finished: boolean } | undefined): boolean {
  return !run || run.finished || run.done.includes('place');
}

/**
 * Whether the bar has a look for Your team's invite to wear (invite-team-last,
 * call 2), and the Theme row's tick: How it looks finished in venue setup, or
 * a logo, a colour or a font other than the app's. Every bar has a font
 * (Instrument Serif unless picked), so the font alone only counts once it's changed.
 */
export function lookSet(brand: { logo_url: string | null; primary_color: string | null; display_face: string | null }, run?: { done: readonly string[] }): boolean {
  return !!run?.done.includes('look') || !!brand.logo_url || !!brand.primary_color || faceFromDb(brand.display_face) !== 'redaction';
}
