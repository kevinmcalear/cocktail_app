// The daily list (Menu-l-tonight-*): tonight's drinks switched on and off
// on the row, the day's author and note (menu_days), the drinks on lately,
// and any other day's list (list_on_day). Each switch saves as it goes.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { useUserId } from '@/ctx/AuthContext';
import { useBarMembers } from '@/hooks/useBarDetail';
import { check, useBarClock, useEndedRuns, useListChanges, useListOnDay, useListRows } from '@/hooks/useLivingList';
import { MENU_DRINK_COLUMNS, toMenuDrink, type MenuItemRow } from '@/hooks/useMenus';
import { barDay, dailyLines, type DailyRun } from '@/lib/dailyList';
import { supabase } from '@/lib/supabase';
import type { MenuDetail, MenuDrink } from '@/types/menus';

export interface MenuDayRow {
  id: string;
  writtenBy: string | null;
  writtenAt: string;
  names: string | null;
  note: string | null;
}

const dayKey = (menuId: string, day: string) => ['living-list', menuId, 'menu-day', day] as const;

/** A daily list's day: who first wrote it, when, the names printed on it and the note for the team. Null: nobody has written it yet. */
export function useMenuDay(menuId: string | null | undefined, day: string | null | undefined) {
  return useQuery({
    queryKey: dayKey(menuId ?? '', day ?? ''),
    enabled: !!menuId && !!day,
    queryFn: async (): Promise<MenuDayRow | null> => {
      const { data, error } = await supabase.from('menu_days').select('id, written_by, names, note, created_at').eq('menu_id', menuId!).eq('day', day!).maybeSingle();
      if (error) throw error;
      return data ? { id: data.id, writtenBy: data.written_by, writtenAt: data.created_at, names: data.names, note: data.note } : null;
    },
  });
}

/** Drinks by id, for the ones not on the list tonight (on lately, or on another day). */
function useDrinks(ids: readonly string[]) {
  const key = [...ids].sort().join(',');
  return useQuery({
    queryKey: ['daily-list-drinks', key],
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<MenuDrink[]> => {
      const { data, error } = await supabase.from('items').select(MENU_DRINK_COLUMNS).in('id', key.split(','));
      if (error) throw error;
      return ((data ?? []) as unknown as MenuItemRow[]).map((i) => toMenuDrink(i)).filter((d): d is MenuDrink => !!d);
    },
  });
}

export interface DailyRow {
  drink: MenuDrink;
  line: string;
  isNew: boolean;
  /** Its row on the list tonight (to switch it off); null when it isn't on. */
  rowId: string | null;
}

/**
 * Tonight's list as the team reads it: the drinks on (with their days on
 * this list) and the ones on lately that aren't, the day's author, time and
 * note, and yesterday's count for Another day.
 */
export function useDailyList(menu: MenuDetail, { staff }: { staff: boolean }) {
  // The clock moves on each minute, so the page turns to the new day at midnight.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const clock = useBarClock(menu.barId);
  const timeZone = clock.data?.timezone ?? null;
  const today = barDay(now, timeZone);
  const rows = useListRows(menu.id);
  const ended = useEndedRuns(menu.id);
  const day = useMenuDay(menu.id, clock.isPending ? null : today);
  const members = useBarMembers(staff ? menu.barId : null);
  const yesterday = useListOnDay(menu.id, clock.isPending ? null : barDay(now - 86_400_000, timeZone));

  const onRows = useMemo(() => (rows.data ?? []).filter((r) => r.state === 'on' || r.state === 'going' || r.state === 'waiting_off'), [rows.data]);
  const lines = useMemo(() => {
    const listStart = menu.startsAt ?? new Date(now).toISOString();
    const runs: DailyRun[] = [
      ...onRows.map((r) => ({ itemId: r.itemId, wentOn: r.onFrom && r.onFrom > listStart ? r.onFrom : listStart, cameOff: null })),
      ...(ended.data ?? []).map((r) => ({ itemId: r.itemId, wentOn: r.wentOn, cameOff: r.cameOff })),
    ];
    return dailyLines(
      onRows.map((r) => r.itemId),
      runs,
      { now, timeZone },
    );
  }, [onRows, ended.data, menu.startsAt, now, timeZone]);

  const known = useMemo(() => new Map(menu.sections.flatMap((s) => s.drinks).map((d) => [d.id, d])), [menu.sections]);
  // On tonight but not in the menu's own read yet, and (for the team) on lately.
  const missing = useMemo(
    () => [...lines.on, ...(staff ? lines.off : [])].map((l) => l.itemId).filter((id) => !known.has(id)),
    [lines.on, lines.off, known, staff],
  );
  const others = useDrinks(missing);
  const drinkOf = (id: string) => known.get(id) ?? others.data?.find((d) => d.id === id);
  const rowOf = new Map(onRows.map((r) => [r.itemId, r.id]));
  const toRow = (l: (typeof lines.on)[number]): DailyRow | null => {
    const drink = drinkOf(l.itemId);
    return drink ? { drink, line: l.line, isNew: l.isNew, rowId: rowOf.get(l.itemId) ?? null } : null;
  };
  const name = (id: string | null) => (id ? (members.data?.find((m) => m.user_id === id)?.display_name ?? 'Someone') : null);

  return {
    today,
    timeZone,
    on: lines.on.map(toRow).filter((r): r is DailyRow => !!r),
    off: staff ? lines.off.map(toRow).filter((r): r is DailyRow => !!r) : [],
    day: day.data ?? null,
    /** The day today's row was read for, once someone has written it. */
    writtenDay: day.data ? today : null,
    writer: name(day.data?.writtenBy ?? null),
    yesterdayCount: yesterday.data ? new Set(yesterday.data.map((r) => r.item_id)).size : null,
    name,
    loading: rows.isPending || ended.isPending || clock.isPending,
    failed: !!rows.error || !!ended.error,
    retry: () => void Promise.all([rows.refetch(), ended.refetch(), clock.refetch(), day.refetch()]),
  };
}

/** Any day's list (Another day): the drinks on it, by name, in the list's order. */
export function useDailyDay(menuId: string, day: string | null) {
  const list = useListOnDay(menuId, day);
  const ids = useMemo(() => [...new Set((list.data ?? []).map((r) => r.item_id))], [list.data]);
  const drinks = useDrinks(ids);
  const written = useMenuDay(menuId, day);
  return {
    drinks: ids.map((id) => drinks.data?.find((d) => d.id === id)).filter((d): d is MenuDrink => !!d),
    count: ids.length,
    day: written.data ?? null,
    loading: list.isPending || (ids.length > 0 && drinks.isPending),
    failed: !!list.error || !!drinks.error,
    retry: () => void Promise.all([list.refetch(), drinks.refetch(), written.refetch()]),
  };
}

/**
 * The daily list's writes. A switch puts a drink on (a new run from now) or
 * takes it off (its run ends now, and is kept); the first change of the day
 * writes the day as the caller's. The note is the day's own.
 */
export function useDailyWrites(menu: MenuDetail, { timeZone, writtenDay }: { timeZone: string | null; writtenDay: string | null }) {
  const client = useQueryClient();
  const userId = useUserId();
  const changes = useListChanges(menu.id);
  // The day is read when the write happens, so a page left open past midnight writes the new day.
  const claimDay = async () => {
    const today = barDay(Date.now(), timeZone);
    if (!userId) throw new Error('Sign in to change tonight’s list.');
    // The day stays the first writer's: a later change doesn't take it over.
    if (writtenDay !== today) await check(supabase.from('menu_days').upsert({ menu_id: menu.id, day: today, written_by: userId }, { onConflict: 'menu_id,day', ignoreDuplicates: true }));
    return today;
  };
  const dayChanged = () => client.invalidateQueries({ queryKey: ['living-list', menu.id, 'menu-day'] });
  const section = menu.sections[0];
  return {
    switchOn: useMutation({
      mutationFn: async (itemId: string) => {
        if (!section) throw new Error('This list has no section to put a drink in.');
        await claimDay();
        await changes.add.mutateAsync({ sectionId: section.id, itemId, sortOrder: section.drinks.length });
      },
      onSettled: dayChanged,
      onError: () => {},
    }),
    switchOff: useMutation({
      mutationFn: async (rowId: string) => {
        await claimDay();
        await changes.takeOff.mutateAsync({ rowId });
      },
      onSettled: dayChanged,
      onError: () => {},
    }),
    note: useMutation({
      mutationFn: async (note: string) => {
        const today = await claimDay();
        await check(supabase.from('menu_days').update({ note: note.trim() || null }).eq('menu_id', menu.id).eq('day', today));
      },
      onSuccess: dayChanged,
      onError: () => {},
    }),
  };
}
