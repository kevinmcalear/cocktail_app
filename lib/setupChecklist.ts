/**
 * "Set up Little Rye" (board Kept-onboard, "Owner, after the three steps"):
 * the owner's checklist once the bar is found, claimed and has tonight's
 * menu. Eight rows; the rest can wait. Each row opens its screen and comes
 * back here. Whether a row is done comes from the bar's own data; skips are
 * kept with the setup on the device. Checked by lib/setupChecklist.check.ts.
 */

import { faceFromDb } from './brand';

// `line` is the row's muted line until it's done (the board's, where it draws one).
export const CHECKLIST_ROWS = [
  { key: 'claim', title: 'Claim it', line: 'A call to the bar’s listed number' },
  { key: 'menu', title: 'Tonight’s menu', line: 'A photo of the one you have' },
  { key: 'place', title: 'Where and when', line: 'Your address and hours' },
  { key: 'glass', title: 'Glassware from your drinks', line: '2 minutes' },
  { key: 'team', title: 'Invite your team', line: 'One link for everyone' },
  { key: 'visibility', title: 'Who sees your page', line: 'Menu, for now' },
  { key: 'theme', title: 'Theme', line: 'Your colour and your type' },
  // Optional: it never holds the checklist open.
  { key: 'calendars', title: 'Calendars', line: 'Optional' },
] as const;

const OPTIONAL: readonly string[] = ['calendars'];

export type ChecklistKey = (typeof CHECKLIST_ROWS)[number]['key'];
export type RowState = 'done' | 'now' | 'todo' | 'skipped';

export interface Checklist {
  rows: { key: ChecklistKey; title: string; line: string; state: RowState }[];
  done: number;
  total: number;
  /** The first row neither done nor skipped. */
  next: ChecklistKey | null;
  /** Every row that isn't optional done or skipped: the checklist leaves the top of the bar. */
  finished: boolean;
}

/** Where each row stands, the first open one being "now". */
export function checklist(done: Readonly<Record<ChecklistKey, boolean>>, skipped: readonly string[] = []): Checklist {
  const open = (key: ChecklistKey) => !done[key] && !skipped.includes(key);
  const next = CHECKLIST_ROWS.find((r) => open(r.key))?.key ?? null;
  const rows = CHECKLIST_ROWS.map((r) => ({ key: r.key, title: r.title, line: r.line, state: (done[r.key] ? 'done' : r.key === next ? 'now' : skipped.includes(r.key) ? 'skipped' : 'todo') as RowState }));
  const count = rows.filter((r) => r.state === 'done').length;
  return { rows, done: count, total: rows.length, next, finished: CHECKLIST_ROWS.every((r) => OPTIONAL.includes(r.key) || !open(r.key)) };
}

/** "Owner · 3 of 8 done": over the title. */
export const checklistEyebrow = (list: Pick<Checklist, 'done' | 'total'>) => `Owner · ${list.done} of ${list.total} done`;

/** "Winter · 4 drinks": the menu row once there's one. */
export function menuNote(menu: { name: string; itemIds: readonly unknown[] } | undefined): string | undefined {
  if (!menu) return undefined;
  const n = menu.itemIds.length;
  return n ? `${menu.name} · ${n} ${n === 1 ? 'drink' : 'drinks'}` : menu.name;
}

/** "2 glasses, 1 ice, 3 tools so far": what the glassware row has, the empty ones left out. */
export function kitNote(glasses: number, ice: number, tools: number): string | undefined {
  const parts = [glasses ? `${glasses} ${glasses === 1 ? 'glass' : 'glasses'}` : null, ice ? `${ice} ice` : null, tools ? `${tools} ${tools === 1 ? 'tool' : 'tools'}` : null].filter(Boolean);
  return parts.length ? `${parts.join(', ')} so far` : undefined;
}

/**
 * A venue setup step passed on this device. A venue with no setup here was
 * set up elsewhere, so its steps count as done.
 */
export const setupStepDone = (run: { done: readonly string[]; finished?: boolean } | undefined, step: string) => !run || run.done.includes(step);

/**
 * Whether the bar has a look of its own (Theme, and Your team's invite wears
 * it: invite-team-last, call 2): How it looks finished in venue setup, or a
 * logo, a colour or a font other than the app's. Every bar has a font
 * (Instrument Serif unless picked), so the font alone only counts once it's changed.
 */
export function lookSet(brand: { logo_url: string | null; primary_color: string | null; display_face: string | null }, run?: { done: readonly string[] }): boolean {
  return !!run?.done.includes('look') || !!brand.logo_url || !!brand.primary_color || faceFromDb(brand.display_face) !== 'redaction';
}
