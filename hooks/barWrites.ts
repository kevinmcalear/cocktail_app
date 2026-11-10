// What each behind-the-bar write sends (lib/offlineWrites.ts). Each reads
// only its variables, so a write saved on the phone sends the same after a
// relaunch, when the screen that made it is long gone. Kept apart from the
// screens' hooks so lib/react-query.ts can register them without importing
// those hooks' own imports.
import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { Alert } from 'react-native';

import { existingIngredientId } from '@/lib/ingredientNames';
import { BAR_WRITE } from '@/lib/offlineWrites';
import { DROPDOWNS_QUERY_KEY } from '@/lib/queryDefaults';
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

export interface BottleWrite {
  /** Made on the phone: the new bottle's id, so a resend finds it there. */
  id: string;
  /** The venue's back bar, or null for your own shelf. */
  barId: string | null;
  /** One already here (the shared catalog's, or the venue's own): only put on the back bar or the shelf. */
  existing: boolean;
  name: string;
  maker: string | null;
  abv: number | null;
  genericId: string | null;
  /** The label photo, kept as a new bottle's picture once it's in. */
  photo: string | null;
  /** Saved with no signal (Save on this phone): it says so when it's in, wherever you are by then. */
  queued: boolean;
}

/**
 * A bottle you buy (Add-bottle): a new one is saved (at a venue as the
 * venue's own); at a venue either goes on the back bar's stock list (so both
 * say since when), at home on your shelf. Each step is skipped if already
 * there, so sending twice is the same.
 */
async function sendBottle(w: BottleWrite) {
  let id = w.id;
  if (!w.existing) {
    const row = { id, item_type: 'ingredient' as const, ingredient_role: 'product' as const, name: w.name, brand_maker: w.maker, abv: w.abv, generic_id: w.genericId, bar_id: w.barId };
    const { error } = await supabase.from('items').upsert(row, { onConflict: 'id', ignoreDuplicates: true });
    // The shared catalog already has it by this name or another (the database says which): that one goes on the shelf.
    const already = existingIngredientId(error);
    if (already) id = already;
    else check({ error });
  }
  if (w.barId) check(await supabase.from('back_bar_items').upsert({ bar_id: w.barId, item_id: id, source: 'back_bar' }, { onConflict: 'bar_id,item_id', ignoreDuplicates: true }));
  if (!w.barId) check(await supabase.from('home_bar_items').upsert({ item_id: id }, { onConflict: 'user_id,item_id', ignoreDuplicates: true }));
  return id;
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
  bottle: {
    key: [BAR_WRITE, 'bottle'],
    send: sendBottle,
    // The ingredient lists (hooks/useDropdowns INGREDIENTS_KEY), the back bar's stock list and the shelf (hooks/useHomeBar SHELF_KEY).
    refresh: (w: BottleWrite): QueryKey[] => [[...DROPDOWNS_QUERY_KEY, 'ingredients'], ['ingredients'], ['back-bar-items', w.barId], ['venue-can-make', w.barId], ['home-bar'], ['bar', w.barId]],
    // Run from the write itself (lib/react-query.ts), so a save that waited on the phone through a relaunch still gets its
    // label photo, recents, toast and lists. Loaded once it's in: the photo upload is big, and this file is in every page's first load.
    // A chunk that fails to load (a deploy since) mustn't turn a saved bottle into a failed save: then only its photo is lost, and it says so.
    saved: (qc: QueryClient, id: string, w: BottleWrite) =>
      import('@/hooks/bottleSaved').then(
        (m) => m.bottleSaved(qc, id, w),
        () => void (w.photo && Alert.alert('The label photo didn’t save', 'The bottle is saved. Add the photo again on its page.')),
      ),
    // Only one that waited for signal is said here; the screen says the rest.
    failed: async (e: Error, w: BottleWrite) => {
      // Loaded here, not up top: this file is in every page's first load, the words are only needed on a failure.
      if (w.queued) Alert.alert(`Couldn’t save ${w.name}`, await import('@/lib/saveErrorWords').then((m) => m.saveErrorWords(e), () => 'Something went wrong saving it. Try again.'));
    },
  },
} as const;
