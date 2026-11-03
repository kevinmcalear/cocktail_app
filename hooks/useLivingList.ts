// A bar's living lists (20261203100000_lists_and_runs.sql): each drink on a
// list with its dates and state, the runs that ended, and the changes the
// Menus screens make on the row (Swap, Take off, Add, approve, share).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { dropdownKeys } from '@/hooks/useDropdowns';
import { menuKeys } from '@/hooks/useMenus';
import { parseHours, type BarClock } from '@/lib/barHours';
import { listRowState, type ListRowState } from '@/lib/listRows';
import { supabase } from '@/lib/supabase';

export interface ListRow {
  id: string;
  itemId: string;
  sectionId: string | null;
  sortOrder: number | null;
  price: string | null;
  slotName: string | null;
  onFrom: string | null;
  offAt: string | null;
  addedBy: string | null;
  offBy: string | null;
  replacesItemId: string | null;
  teamSharedAt: string | null;
  /** When the row was made: when a change waiting was asked for. */
  addedAt: string;
  state: ListRowState;
}

/** A drink's run on this list that ended (menu_drinks_removed). */
export interface EndedRun {
  itemId: string;
  sectionName: string | null;
  slotName: string | null;
  price: string | null;
  wentOn: string;
  cameOff: string;
  takenOffBy: string | null;
  addedBy: string | null;
  replacesItemId: string | null;
}

export const listKeys = {
  rows: (menuId: string) => ['living-list', menuId, 'rows'] as const,
  ended: (menuId: string) => ['living-list', menuId, 'ended'] as const,
  mayChange: (menuId: string) => ['living-list', menuId, 'may-change'] as const,
  day: (menuId: string, day: string) => ['living-list', menuId, 'day', day] as const,
};

const ROW_COLUMNS = 'id, item_id, menu_section_id, sort_order, price, slot_name, on_from, off_at, added_by, off_by, replaces_item_id, waiting, team_shared_at, created_at';

/** Every drink on a list, with its state; what the caller may read (planned and waiting rows are the menu team's until shared). */
export function useListRows(menuId: string | null | undefined) {
  return useQuery({
    queryKey: listKeys.rows(menuId ?? ''),
    enabled: !!menuId,
    queryFn: async (): Promise<ListRow[]> => {
      const { data, error } = await supabase.from('menu_drinks').select(ROW_COLUMNS).eq('menu_id', menuId!).order('sort_order');
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        itemId: r.item_id!,
        sectionId: r.menu_section_id,
        sortOrder: r.sort_order,
        price: r.price,
        slotName: r.slot_name,
        onFrom: r.on_from,
        offAt: r.off_at,
        addedBy: r.added_by,
        offBy: r.off_by,
        replacesItemId: r.replaces_item_id,
        teamSharedAt: r.team_shared_at,
        addedAt: r.created_at,
        state: listRowState(r),
      }));
    },
  });
}

/** The runs on this list that ended, latest first. */
export function useEndedRuns(menuId: string | null | undefined) {
  return useQuery({
    queryKey: listKeys.ended(menuId ?? ''),
    enabled: !!menuId,
    queryFn: async (): Promise<EndedRun[]> => {
      const { data, error } = await supabase
        .from('menu_drinks_removed')
        .select('item_id, section_name, slot_name, price, went_on, came_off, taken_off_by, added_by, replaces_item_id')
        .eq('menu_id', menuId!)
        .order('came_off', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        itemId: r.item_id,
        sectionName: r.section_name,
        slotName: r.slot_name,
        price: r.price,
        wentOn: r.went_on,
        cameOff: r.came_off,
        takenOffBy: r.taken_off_by,
        addedBy: r.added_by,
        replacesItemId: r.replaces_item_id,
      }));
    },
  });
}

/** A bar's time zone and hours, for when "after tonight" is: bars.timezone, else its page's, and the hours on its page. */
export function useBarClock(barId: string | null | undefined) {
  return useQuery({
    queryKey: ['bar-clock', barId],
    enabled: !!barId,
    staleTime: 60 * 60_000,
    queryFn: async (): Promise<BarClock> => {
      const [bar, page] = await Promise.all([
        supabase.from('bars').select('timezone').eq('id', barId!).maybeSingle(),
        supabase.from('profiles').select('hours, timezone').eq('bar_id', barId!).eq('kind', 'bar').limit(1).maybeSingle(),
      ]);
      if (bar.error) throw bar.error;
      if (page.error) throw page.error;
      return { timezone: bar.data?.timezone ?? page.data?.timezone ?? null, hours: parseHours(page.data?.hours) };
    },
  });
}

/** Whether the caller's changes to this list go straight on (false: they wait for approval). */
export function useMayChangeList(menuId: string | null | undefined) {
  return useQuery({
    queryKey: listKeys.mayChange(menuId ?? ''),
    enabled: !!menuId,
    staleTime: 60_000,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc('may_change_list', { p_menu_id: menuId! });
      if (error) throw error;
      return !!data;
    },
  });
}

/** The drinks on a list on one day (the bar's day), from the record: the daily list and "the list on a day". */
export function useListOnDay(menuId: string | null | undefined, day: string | null | undefined) {
  return useQuery({
    queryKey: listKeys.day(menuId ?? '', day ?? ''),
    enabled: !!menuId && !!day,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_on_day', { p_menu_id: menuId!, p_day: day! });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useInvalidateList(menuId: string) {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ['living-list', menuId] }),
      client.invalidateQueries({ queryKey: menuKeys.all }),
      client.invalidateQueries({ queryKey: dropdownKeys.currentMenuDrinks }),
      client.invalidateQueries({ queryKey: ['drink-menu-runs'] }),
      client.invalidateQueries({ queryKey: ['menu-runs'] }),
      client.invalidateQueries({ queryKey: ['drink-list-dates'] }),
    ]);
}

export async function check<T extends { error: { message: string } | null }>(res: PromiseLike<T>): Promise<T> {
  const out = await res;
  if (out.error) throw new Error(out.error.message);
  return out;
}

/** An add that finds the drink already on the list is done, not an error (unique violation, 23505). */
async function addOnce(res: PromiseLike<{ error: { message: string; code?: string } | null }>): Promise<void> {
  const out = await res;
  if (out.error && out.error.code !== '23505') throw new Error(out.error.message);
}

/** Said when the database refused a change without an error (row-level security): the list may not be the caller's to change any more. */
export const NOT_CHANGED = 'Couldn’t change the list. It may not be yours to change now.';

/**
 * An update or delete that RLS refuses changes no rows and returns no error,
 * so each one asks for the ids it changed and fails when there are none.
 */
async function changed(res: PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>): Promise<void> {
  const { data } = await check(res);
  if (!data?.length) throw new Error(NOT_CHANGED);
}

/** The changes on a list's rows. `at` null: now; an ISO date: from then (the next service). */
export function useListChanges(menuId: string) {
  const invalidate = useInvalidateList(menuId);
  const opts = { onSuccess: invalidate, onError: () => {} };
  return {
    swap: useMutation({
      mutationFn: async ({ rowId, itemId, at = null }: { rowId: string; itemId: string; at?: string | null }) =>
        (await check(supabase.rpc('swap_menu_drink', { p_row_id: rowId, p_item_id: itemId, ...(at ? { p_at: at } : {}) }))).data,
      ...opts,
    }),
    takeOff: useMutation({
      mutationFn: async ({ rowId, at = null }: { rowId: string; at?: string | null }) =>
        changed(supabase.from('menu_drinks').update({ off_at: at ?? new Date().toISOString() }).eq('id', rowId).select('id')),
      ...opts,
    }),
    add: useMutation({
      mutationFn: async (p: { sectionId: string; itemId: string; sortOrder: number; at?: string | null; slotName?: string | null }) =>
        addOnce(
          supabase.from('menu_drinks').insert({
            menu_id: menuId,
            menu_section_id: p.sectionId,
            item_id: p.itemId,
            sort_order: p.sortOrder,
            on_from: p.at ?? null,
            slot_name: p.slotName ?? null,
          })
        ),
      ...opts,
    }),
    /**
     * Takes back a swap: the drink swapped in goes, the one it replaced stays
     * (planned) or comes back in its place (already done).
     */
    // ponytail: a swap already done leaves both short runs in menu_drinks_removed (the client can't write the record); a gated undo_swap RPC could drop them within a few minutes.
    undoSwap: useMutation({
      mutationFn: async ({ swappedIn, replaced }: { swappedIn: ListRow; replaced: ListRow | null }) => {
        if (!swappedIn.replacesItemId) throw new Error('That drink wasn’t swapped in.');
        await changed(supabase.from('menu_drinks').delete().eq('id', swappedIn.id).select('id'));
        if (replaced) {
          await changed(supabase.from('menu_drinks').update({ off_at: null }).eq('id', replaced.id).select('id'));
          return;
        }
        await addOnce(
          supabase.from('menu_drinks').insert({
            menu_id: menuId,
            menu_section_id: swappedIn.sectionId,
            item_id: swappedIn.replacesItemId,
            sort_order: swappedIn.sortOrder ?? 0,
            slot_name: swappedIn.slotName,
          })
        );
      },
      ...opts,
    }),
    /** Approves a waiting change (only someone who may change the list). */
    approve: useMutation({
      mutationFn: async (rowId: string) => changed(supabase.from('menu_drinks').update({ waiting: null }).eq('id', rowId).select('id')),
      ...opts,
    }),
    /** Turns down a waiting change: an add goes, a take-off is withdrawn. */
    turnDown: useMutation({
      mutationFn: async ({ rowId, waiting }: { rowId: string; waiting: 'on' | 'off' }) =>
        changed(
          waiting === 'on'
            ? supabase.from('menu_drinks').delete().eq('id', rowId).select('id')
            : supabase.from('menu_drinks').update({ off_at: null }).eq('id', rowId).select('id')
        ),
      ...opts,
    }),
    /** Shares a planned drink with the whole bar to learn (or stops sharing it). */
    shareDrink: useMutation({
      mutationFn: async ({ rowId, shared }: { rowId: string; shared: boolean }) =>
        changed(supabase.from('menu_drinks').update({ team_shared_at: shared ? new Date().toISOString() : null }).eq('id', rowId).select('id')),
      ...opts,
    }),
    /** Shares a list that hasn't started with the whole bar (or stops sharing it). */
    shareList: useMutation({
      mutationFn: async (shared: boolean) =>
        changed(supabase.from('menus').update({ team_shared_at: shared ? new Date().toISOString() : null }).eq('id', menuId).select('id')),
      ...opts,
    }),
    /** Hides a list that ran from the bar page and drink pages (it is never deleted). */
    hide: useMutation({
      mutationFn: async (hidden: boolean) =>
        changed(supabase.from('menus').update({ hidden_at: hidden ? new Date().toISOString() : null }).eq('id', menuId).select('id')),
      ...opts,
    }),
  };
}
