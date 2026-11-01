// What each behind-the-bar write sends (lib/offlineWrites.ts). Each reads
// only its variables, so a write saved on the phone sends the same after a
// relaunch, when the screen that made it is long gone. Kept apart from the
// screens' hooks so lib/react-query.ts can register them without importing
// those hooks' own imports.
import type { QueryKey } from '@tanstack/react-query';

import { BAR_WRITE } from '@/lib/offlineWrites';
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

export const BAR_WRITES = {
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
} as const;
