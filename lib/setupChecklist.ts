/**
 * "Set up Little Rye" (owner-setup step 5, calls 6 to 8): the checklist that
 * replaces What next. It stays on top of the bar until each row is done or
 * skipped, and every row's screen comes back to it. Whether a row is done
 * comes from the bar's own data; skips are kept with the setup on the device.
 * Checked by lib/setupChecklist.check.ts.
 */

export const CHECKLIST_ROWS = [
  { key: 'bar', title: 'Basic information', line: 'Where, how it looks, who sees it' },
  // Kit is one row: glassware, ice and tools (call 8).
  { key: 'kit', title: 'Kit', line: 'Glasses, ice and tools' },
  { key: 'bottles', title: 'Bottles', line: 'What’s on your shelves' },
  { key: 'menu', title: 'First menu', line: 'Start your own, or bring one in' },
  { key: 'drinks', title: 'First drinks', line: 'On that menu, with your house recipes' },
  { key: 'team', title: 'Your team', line: 'Invite who works here' },
] as const;

export type ChecklistKey = (typeof CHECKLIST_ROWS)[number]['key'];
export type RowState = 'done' | 'now' | 'todo' | 'skipped';

export interface Checklist {
  rows: { key: ChecklistKey; title: string; line: string; state: RowState }[];
  done: number;
  total: number;
  /** The first row neither done nor skipped: the one with Continue. */
  next: ChecklistKey | null;
  /** Every row done or skipped: the checklist leaves the top of the bar. */
  finished: boolean;
}

/** Where each row stands, the first open one being "now". */
export function checklist(done: Readonly<Record<ChecklistKey, boolean>>, skipped: readonly string[] = []): Checklist {
  const next = CHECKLIST_ROWS.find((r) => !done[r.key] && !skipped.includes(r.key))?.key ?? null;
  const rows = CHECKLIST_ROWS.map((r) => ({ ...r, state: (done[r.key] ? 'done' : r.key === next ? 'now' : skipped.includes(r.key) ? 'skipped' : 'todo') as RowState }));
  const count = rows.filter((r) => r.state === 'done').length;
  return { rows, done: count, total: rows.length, next, finished: next === null };
}

/** "2 glasses, 1 ice, 3 tools so far": what the Kit row has, the empty ones left out. */
export function kitNote(glasses: number, ice: number, tools: number): string | undefined {
  const parts = [glasses ? `${glasses} ${glasses === 1 ? 'glass' : 'glasses'}` : null, ice ? `${ice} ice` : null, tools ? `${tools} ${tools === 1 ? 'tool' : 'tools'}` : null].filter(Boolean);
  return parts.length ? `${parts.join(', ')} so far` : undefined;
}

const WORDS = ['None', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];

/** "Three of six done. Each one brings you back here." */
export function checklistIntro(list: Pick<Checklist, 'done' | 'total'>): string {
  const of = WORDS[list.total]?.toLowerCase() ?? String(list.total);
  const head = list.done === 0 ? `${WORDS[list.total] ?? list.total} things to set up.` : `${WORDS[list.done] ?? list.done} of ${of} done.`;
  return `${head} Each one brings you back here.`;
}

/** Your bar is done once venue setup got past who sees what (the summary, or those three steps). */
export function barSetUp(run: { done: readonly string[]; finished: boolean } | undefined): boolean {
  return !!run && (run.finished || ['place', 'look', 'visibility'].every((s) => run.done.includes(s)));
}
