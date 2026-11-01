// Where a drink stands on a living list (20261203100000_lists_and_runs.sql):
// a menu_drinks row is on now, coming (planned for later), going (a planned
// take-off), or waiting for approval to go on or come off. The database
// keeps runs that ended in menu_drinks_removed, so a row here is never
// "ended".

export type ListRowState = 'on' | 'coming' | 'going' | 'waiting_on' | 'waiting_off';

export interface ListRowDates {
  on_from: string | null;
  off_at: string | null;
  waiting: string | null;
}

/** The row's state at `now` (ms). A row with no on_from went on with its list. */
export function listRowState(row: ListRowDates, now = Date.now()): ListRowState {
  if (row.waiting === 'on') return 'waiting_on';
  if (row.on_from && Date.parse(row.on_from) > now) return 'coming';
  if (row.waiting === 'off') return 'waiting_off';
  if (row.off_at) return 'going';
  return 'on';
}

/** On the list now: guests and staff see it (a waiting take-off stays on until approved). */
export function isOnNow(row: ListRowDates, now = Date.now()): boolean {
  const state = listRowState(row, now);
  return state === 'on' || state === 'going' || state === 'waiting_off';
}

/**
 * PostgREST filters for rows on a list now, for a query on menu_drinks
 * (`referencedTable` for one embedded under menus or menu_sections): not
 * waiting to go on, and on from now or earlier.
 */
export function onNowFilters(nowIso = new Date().toISOString()): string[] {
  return ['waiting.is.null,waiting.eq.off', `on_from.is.null,on_from.lte.${nowIso}`];
}
