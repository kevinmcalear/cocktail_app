// What happens around a living list besides the list itself
// (20261205900000_list_asks_notices_off_tonight.sql): a bartender's asks
// (Menu-l-ask, Menu-l-approve), the notes that tell the team about a change
// (Tell the team, Menu-l-swapped), and drinks off for tonight only
// (Menu-l-swap's third act). The list's own changes are useListChanges.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { BAR_WRITES, type OffTonightWrite } from '@/hooks/barWrites';
import { useListChanges, type ListRow } from '@/hooks/useLivingList';
import { MENU_DRINK_COLUMNS, toMenuDrink, type MenuItemRow } from '@/hooks/useMenus';
import { newDraftId } from '@/lib/drinkWizard';
import { supabase } from '@/lib/supabase';
import type { MenuDrink } from '@/types/menus';

/** A change someone asked for: a drink on (itemId), off (offItemId), or one in place of the other; now or from `at`. */
export interface ListAsk {
  id: string;
  menuId: string;
  itemId: string | null;
  /** The drink going on, to draw its row (null for a take-off). */
  drink: MenuDrink | null;
  offItemId: string | null;
  sectionId: string | null;
  at: string | null;
  price: string | null;
  /** Null: a draft only its writer sees. */
  askedAt: string | null;
  createdBy: string;
  createdAt: string;
}

export type NoticeKind = 'on' | 'off' | 'swap' | 'off_tonight' | 'back';

/** One change told to the team. */
export interface ListNotice {
  id: string;
  menuId: string;
  menuName: string;
  itemId: string;
  kind: NoticeKind;
  toItemId: string | null;
  at: string;
  toldBy: string;
}

/** A drink off for tonight only. */
export interface OffTonight {
  id: string;
  menuId: string;
  itemId: string;
  until: string;
}

export const askKeys = {
  asks: (menuId: string) => ['living-list', menuId, 'asks'] as const,
  notices: (barId: string) => ['list-notices', barId] as const,
  offTonight: (barId: string) => ['off-tonight', barId] as const,
};

/** The asks on a list the caller reads: their own (drafts too) and, for the menu team, everyone's that were asked. */
export function useListAsks(menuId: string | null | undefined) {
  return useQuery({
    queryKey: askKeys.asks(menuId ?? ''),
    enabled: !!menuId,
    queryFn: async (): Promise<ListAsk[]> => {
      const { data, error } = await supabase
        .from('menu_drink_asks')
        .select(`id, menu_id, item_id, off_item_id, menu_section_id, at, price, asked_at, created_by, created_at, item:items!menu_drink_asks_item_id_fkey(${MENU_DRINK_COLUMNS})`)
        .eq('menu_id', menuId!)
        .order('created_at');
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        menuId: r.menu_id,
        itemId: r.item_id,
        drink: r.item ? toMenuDrink(r.item as unknown as MenuItemRow) : null,
        offItemId: r.off_item_id,
        sectionId: r.menu_section_id,
        at: r.at,
        price: r.price,
        askedAt: r.asked_at,
        createdBy: r.created_by,
        createdAt: r.created_at,
      }));
    },
  });
}

async function check<T extends { error: { message: string } | null }>(res: PromiseLike<T>): Promise<T> {
  const out = await res;
  if (out.error) throw new Error(out.error.message);
  return out;
}

/** One change to tell the team about. */
export interface Tell {
  itemId: string;
  kind: NoticeKind;
  toItemId?: string | null;
  /** When it lands (a swap after tonight is told now, dated then). */
  at?: string | null;
}

async function tell(menuId: string, changes: Tell[]) {
  if (!changes.length) return;
  const now = new Date().toISOString();
  // A change from later is told now; the database refuses a notice dated ahead.
  await check(supabase.from('menu_list_notices').insert(changes.map((c) => ({ menu_id: menuId, item_id: c.itemId, kind: c.kind, to_item_id: c.toItemId ?? null, at: c.at && c.at < now ? c.at : now }))));
}

/** Tell the team (the swap sheet's switch, on by default). */
export function useTellTeam(menuId: string, barId: string | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (changes: Tell[]) => tell(menuId, changes),
    onSuccess: () => client.invalidateQueries({ queryKey: askKeys.notices(barId ?? '') }),
    onError: () => {},
  });
}

/**
 * A bartender's changes, and the menu team's answer (Menu-l-ask,
 * Menu-l-approve): keep a draft, ask, withdraw; approve (the change goes on
 * with the calls the team already have, then the ask goes) or turn down.
 */
export function useAskChanges(menuId: string, barId: string | null) {
  const client = useQueryClient();
  const list = useListChanges(menuId);
  const refresh = () =>
    Promise.all([client.invalidateQueries({ queryKey: askKeys.asks(menuId) }), client.invalidateQueries({ queryKey: askKeys.notices(barId ?? '') })]);
  const opts = { onSuccess: refresh, onError: () => {} };
  return {
    /** A new ask; `asked` false keeps it a draft only its writer sees. */
    create: useMutation({
      mutationFn: async (p: { itemId?: string | null; offItemId?: string | null; sectionId?: string | null; at?: string | null; asked: boolean }) =>
        void (await check(
          supabase.from('menu_drink_asks').insert({
            menu_id: menuId,
            item_id: p.itemId ?? null,
            off_item_id: p.offItemId ?? null,
            menu_section_id: p.sectionId ?? null,
            at: p.at ?? null,
            asked_at: p.asked ? new Date().toISOString() : null,
          })
        )),
      ...opts,
    }),
    /** Ask to put a draft on: the menu team see it. */
    ask: useMutation({
      mutationFn: async (id: string) => void (await check(supabase.from('menu_drink_asks').update({ asked_at: new Date().toISOString() }).eq('id', id))),
      ...opts,
    }),
    /** Withdraw (the writer) or turn down (the menu team): the ask goes and nothing changes. */
    drop: useMutation({
      mutationFn: async (id: string) => void (await check(supabase.from('menu_drink_asks').delete().eq('id', id))),
      ...opts,
    }),
    /** Approve: the change goes on the list now or from its date, the team are told, and the ask goes. */
    approve: useMutation({
      mutationFn: async ({ ask, rows, sectionId }: { ask: ListAsk; rows: ListRow[]; sectionId: string | null }) => {
        const out = ask.offItemId ? rows.find((r) => r.itemId === ask.offItemId && (r.state === 'on' || r.state === 'waiting_off')) : undefined;
        if (ask.offItemId && !out) throw new Error('That drink isn’t on the list any more.');
        if (ask.itemId && out) await list.swap.mutateAsync({ rowId: out.id, itemId: ask.itemId, at: ask.at });
        else if (out) await list.takeOff.mutateAsync({ rowId: out.id, at: ask.at });
        else if (ask.itemId) {
          const section = ask.sectionId ?? sectionId;
          if (!section) throw new Error('Pick a section for it first.');
          await list.add.mutateAsync({ sectionId: section, itemId: ask.itemId, sortOrder: 999, at: ask.at });
        }
        await tell(menuId, [
          ask.itemId && ask.offItemId
            ? { itemId: ask.offItemId, kind: 'swap', toItemId: ask.itemId, at: ask.at }
            : ask.itemId
              ? { itemId: ask.itemId, kind: 'on', at: ask.at }
              : { itemId: ask.offItemId!, kind: 'off', at: ask.at },
        ]);
        await check(supabase.from('menu_drink_asks').delete().eq('id', ask.id));
      },
      ...opts,
    }),
  };
}

/** The changes told at a bar since a time, newest first (Tonight's "Changes since you were in", Team · told at). */
export function useListNotices(barId: string | null | undefined, sinceIso: string | null) {
  return useQuery({
    queryKey: [...askKeys.notices(barId ?? ''), sinceIso],
    enabled: !!barId,
    queryFn: async (): Promise<ListNotice[]> => {
      let q = supabase.from('menu_list_notices').select('id, menu_id, item_id, kind, to_item_id, at, told_by, menu:menus!inner(name, bar_id)').eq('menu.bar_id', barId!);
      if (sinceIso) q = q.gte('at', sinceIso);
      const { data, error } = await q.order('at', { ascending: false }).limit(100);
      if (error) throw error;
      return (data ?? []).map((n) => ({
        id: n.id,
        menuId: n.menu_id,
        menuName: n.menu?.name ?? '',
        itemId: n.item_id,
        kind: n.kind as NoticeKind,
        toItemId: n.to_item_id,
        at: n.at,
        toldBy: n.told_by,
      }));
    },
  });
}

/** Drinks off for tonight at a bar, on any of its lists; a row past its close no longer counts. */
export function useOffTonight(barId: string | null | undefined) {
  return useQuery({
    queryKey: askKeys.offTonight(barId ?? ''),
    enabled: !!barId,
    staleTime: 60_000,
    queryFn: async (): Promise<OffTonight[]> => {
      const { data, error } = await supabase
        .from('menu_off_tonight')
        .select('id, menu_id, item_id, until, menu:menus!inner(bar_id)')
        .eq('menu.bar_id', barId!)
        .gt('until', new Date().toISOString());
      if (error) throw error;
      return (data ?? []).map((r) => ({ id: r.id, menuId: r.menu_id, itemId: r.item_id, until: r.until }));
    },
  });
}

/**
 * Off tonight, and back on: works with no signal (hooks/barWrites.ts), so the
 * row changes on the phone at once. Use `set`/`clear`; each waits on the
 * phone until it sends.
 */
export function useSetOffTonight(barId: string) {
  const client = useQueryClient();
  const write = BAR_WRITES.offTonight;
  const mutation = useMutation({
    mutationKey: write.key,
    mutationFn: write.send,
    onMutate: async (w: OffTonightWrite) => {
      const key = askKeys.offTonight(barId);
      await client.cancelQueries({ queryKey: key });
      client.setQueryData<OffTonight[]>(key, (old = []) =>
        w.until ? [...old.filter((o) => o.id !== w.id), { id: w.id, menuId: w.menuId, itemId: w.itemId, until: w.until }] : old.filter((o) => o.id !== w.id)
      );
    },
    onSettled: (_r, _e, w) => {
      for (const queryKey of write.refresh(w)) void client.invalidateQueries({ queryKey });
    },
  });
  return {
    isPending: mutation.isPending,
    set: (menuId: string, itemId: string, until: string) => mutation.mutate({ id: newDraftId(), barId, menuId, itemId, until }),
    clear: (off: OffTonight) => mutation.mutate({ id: off.id, barId, menuId: off.menuId, itemId: off.itemId, until: null }),
  };
}
