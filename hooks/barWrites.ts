// What each behind-the-bar write sends (lib/offlineWrites.ts). Each reads
// only its variables, so a write saved on the phone sends the same after a
// relaunch, when the screen that made it is long gone. Kept apart from the
// screens' hooks so lib/react-query.ts can register them without importing
// those hooks' own imports.
import type { QueryKey } from '@tanstack/react-query';

import { BAR_WRITE } from '@/lib/offlineWrites';
import type { RotaChange } from '@/lib/rota';
import { supabase } from '@/lib/supabase';

const check = <T extends { error: { message: string } | null }>(res: T) => {
  if (res.error) throw res.error;
  return res;
};

export interface ZoneCountWrite {
  /** Made on the phone: the count row's id, so a resend finds it there. */
  id: string;
  barId: string;
  zoneId: string | null;
  note: string | null;
  countedBy: string | null;
  lines: { id: string; item_id: string; location_id: string | null; amount: number; unit: string }[];
}

/** One zone's count: the count row, then its lines, each skipped if already there. */
async function sendZoneCount(w: ZoneCountWrite) {
  check(await supabase.from('stock_counts').upsert({ id: w.id, bar_id: w.barId, zone_id: w.zoneId, note: w.note, counted_by: w.countedBy }, { onConflict: 'id', ignoreDuplicates: true }));
  if (w.lines.length) check(await supabase.from('stock_count_lines').upsert(w.lines.map((l) => ({ ...l, count_id: w.id })), { onConflict: 'id', ignoreDuplicates: true }));
  return w.id;
}

export interface SwapChange {
  menuDrinkId: string;
  fromItemId: string;
  /** Null puts the library's bottle back. */
  to: { id: string; name: string } | null;
}
export interface SwapsWrite {
  menuId: string;
  changes: SwapChange[];
}

/** Swaps for one menu: set by their pair, cleared by deleting the pair, so sending twice is the same. */
async function sendSwaps({ changes }: SwapsWrite) {
  const set = changes.filter((c) => c.to && c.to.id !== c.fromItemId);
  const clear = changes.filter((c) => !c.to || c.to.id === c.fromItemId);
  if (set.length) {
    const rows = set.map((c) => ({ menu_drink_id: c.menuDrinkId, from_item_id: c.fromItemId, to_item_id: c.to!.id }));
    check(await supabase.from('menu_run_swaps').upsert(rows, { onConflict: 'menu_drink_id,from_item_id' }));
  }
  for (const c of clear) check(await supabase.from('menu_run_swaps').delete().eq('menu_drink_id', c.menuDrinkId).eq('from_item_id', c.fromItemId));
}

export interface ServesWrite {
  menuId: string;
  menuDrinkIds: string[];
  /** Null clears them. */
  serves: number | null;
}

async function sendServes({ menuDrinkIds, serves }: ServesWrite) {
  check(await supabase.from('menu_drinks').update({ serves }).in('id', menuDrinkIds));
}

export interface BatchWrite {
  /** Made on the phone, so a resend finds the row there. */
  id: string;
  barId: string;
  itemId: string;
  amount: number;
  unit: string;
  madeAt: string;
  madeBy: string | null;
  locationId: string | null;
  note: string | null;
}

/** One batch of house-made (Log batch), skipped if already there. */
async function sendBatch(w: BatchWrite) {
  check(
    await supabase
      .from('batch_logs')
      .upsert({ id: w.id, bar_id: w.barId, item_id: w.itemId, amount: w.amount, unit: w.unit, made_at: w.madeAt, made_by: w.madeBy, location_id: w.locationId, note: w.note }, { onConflict: 'id', ignoreDuplicates: true })
  );
  return w.id;
}

export interface OffTonightWrite {
  /** Made on the phone, so a resend finds the row there. */
  id: string;
  barId: string;
  menuId: string;
  itemId: string;
  /** The bar's close tonight; null puts the drink back (deletes the row by id). */
  until: string | null;
}

/** A drink off for tonight only (menu_off_tonight), or back on: sending twice is the same. */
async function sendOffTonight(w: OffTonightWrite) {
  if (w.until) check(await supabase.from('menu_off_tonight').upsert({ id: w.id, menu_id: w.menuId, item_id: w.itemId, until: w.until }, { onConflict: 'id', ignoreDuplicates: true }));
  else check(await supabase.from('menu_off_tonight').delete().eq('id', w.id));
}

export interface ShiftsWrite extends RotaChange {
  barId: string;
}

/** The rota: rows by their phone-made ids, so a resend finds them there, and removals, which change nothing the second time. */
async function sendShifts({ barId, rows, removed }: ShiftsWrite) {
  if (rows.length) check(await supabase.from('shifts').upsert(rows.map((r) => ({ ...r, bar_id: barId })), { onConflict: 'id' }));
  if (removed.length) check(await supabase.from('shifts').delete().eq('bar_id', barId).in('id', removed));
}

export interface HandoverWrite {
  barId: string;
  /** The service day of the close (YYYY-MM-DD). */
  closeDate: string;
  userId: string;
  /** What they wrote; left out when only marking the note read. */
  words?: { ranOut: string[]; note: string | null; prep: string | null; broken: string | null; brokenPhoto: string | null; writtenAt: string };
  readAt: string;
}

/** What someone wrote, as handover_notes columns (also the page's at-once copy, hooks/useHandover.ts). */
export const handoverColumns = (words: HandoverWrite['words']) =>
  words ? { ran_out: words.ranOut, note: words.note, prep: words.prep, broken: words.broken, broken_photo: words.brokenPhoto, written_at: words.writtenAt } : {};

/** A person's row for a close (the handover note), by bar, day and person, so sending twice is the same. */
async function sendHandover(w: HandoverWrite) {
  check(await supabase.from('handover_notes').upsert({ bar_id: w.barId, close_date: w.closeDate, user_id: w.userId, read_at: w.readAt, ...handoverColumns(w.words) }, { onConflict: 'bar_id,close_date,user_id' }));
}

export const BAR_WRITES = {
  offTonight: {
    key: [BAR_WRITE, 'off-tonight'],
    send: sendOffTonight,
    refresh: (w: OffTonightWrite): QueryKey[] => [['off-tonight', w.barId]],
  },
  zoneCount: {
    key: [BAR_WRITE, 'zone-count'],
    send: sendZoneCount,
    refresh: (w: ZoneCountWrite): QueryKey[] => [['stock-on-hand', w.barId], ['prep-data']],
  },
  swaps: {
    key: [BAR_WRITE, 'run-swaps'],
    send: sendSwaps,
    refresh: (w: SwapsWrite): QueryKey[] => [['run-sheet', w.menuId]],
  },
  batch: {
    key: [BAR_WRITE, 'batch'],
    send: sendBatch,
    refresh: (w: BatchWrite): QueryKey[] => [['batch-logs', w.barId], ['prep-data']],
  },
  serves: {
    key: [BAR_WRITE, 'run-serves'],
    send: sendServes,
    refresh: (w: ServesWrite): QueryKey[] => [['run-sheet', w.menuId]],
  },
  shifts: {
    key: [BAR_WRITE, 'shifts'],
    send: sendShifts,
    refresh: (w: ShiftsWrite): QueryKey[] => [['shifts', w.barId]],
  },
  handover: {
    key: [BAR_WRITE, 'handover'],
    send: sendHandover,
    refresh: (w: HandoverWrite): QueryKey[] => [['handover', w.barId]],
  },
} as const;
