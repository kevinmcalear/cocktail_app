import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { editionDates, type MenuDates, type MenuEdition } from '@/lib/menuEditions';
import { supabase } from '@/lib/supabase';

/**
 * The bars and bar menus a home bartender keeps in Collection: bars they
 * love (loved_bars) and menus they saved (saved_menu_editions). Both are
 * private to them. Plain JSON (the query cache is persisted).
 */

export interface LovedBar {
  id: string;
  handle: string | null;
  name: string;
  avatarUrl: string | null;
  place: string | null;
  /** The menu the bar is pouring now, when we know it. */
  currentMenu: { id: string; name: string } | null;
}

export interface SavedMenu {
  editionId: string;
  name: string;
  barId: string;
  barHandle: string | null;
  barName: string;
  dates: MenuDates;
  drinkIds: string[];
}

interface LovedRow {
  profile: { id: string; handle: string | null; display_name: string; avatar_url: string | null; locality: string | null; city: string | null } | null;
}

type EditionCols = Pick<MenuEdition, 'id' | 'name' | 'year' | 'month' | 'end_year' | 'end_month' | 'is_current'>;
interface SavedRow {
  edition: (EditionCols & { profile: { id: string; handle: string | null; display_name: string } | null }) | null;
}

const lovedKey = (userId: string | null) => ['loved-bars', userId] as const;
const savedKey = (userId: string | null) => ['saved-menus', userId] as const;

/** Bars you love, latest first, each with the menu it's pouring now. */
export function useLovedBars() {
  const userId = useUserId();
  return useQuery({
    queryKey: lovedKey(userId),
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<LovedBar[]> => {
      const { data, error } = await supabase
        .from('loved_bars')
        .select('profile:profiles!profile_id(id, handle, display_name, avatar_url, locality, city)')
        .order('loved_at', { ascending: false });
      if (error) throw error;
      // A bar whose page went private drops out (its profile embed comes back empty).
      const bars = ((data ?? []) as unknown as LovedRow[]).flatMap((r) => (r.profile ? [r.profile] : []));
      const current = bars.length
        ? await supabase.from('profile_menu_editions').select('id, name, profile_id').in('profile_id', bars.map((b) => b.id)).eq('is_current', true)
        : { data: [], error: null };
      if (current.error) throw current.error;
      const menus = (current.data ?? []) as { id: string; name: string; profile_id: string }[];
      return bars.map((b) => {
        const menu = menus.find((m) => m.profile_id === b.id);
        return {
          id: b.id,
          handle: b.handle,
          name: b.display_name,
          avatarUrl: b.avatar_url,
          place: [b.locality, b.city].filter(Boolean).join(', ') || null,
          currentMenu: menu ? { id: menu.id, name: menu.name } : null,
        };
      });
    },
  });
}

/** Love a bar, or stop. */
export function useLoveBar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ profileId, love }: { profileId: string; love: boolean }) => {
      const { error } = love
        ? await supabase.from('loved_bars').upsert({ profile_id: profileId }, { onConflict: 'user_id,profile_id', ignoreDuplicates: true })
        : await supabase.from('loved_bars').delete().eq('profile_id', profileId);
      if (error) throw new Error(error.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['loved-bars'] }),
    onError: () => {},
  });
}

/** Bar menus you saved, latest first, with their drinks' ids. */
export function useSavedMenus() {
  const userId = useUserId();
  return useQuery({
    queryKey: savedKey(userId),
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<SavedMenu[]> => {
      const { data, error } = await supabase
        .from('saved_menu_editions')
        .select('edition:profile_menu_editions!edition_id(id, name, year, month, end_year, end_month, is_current, profile:profiles!profile_id(id, handle, display_name))')
        .order('saved_at', { ascending: false });
      if (error) throw error;
      const editions = ((data ?? []) as unknown as SavedRow[]).flatMap((r) => (r.edition?.profile ? [r.edition] : []));
      const drinks = editions.length
        ? await supabase.from('profile_menu_edition_drinks').select('edition_id, item_id').in('edition_id', editions.map((e) => e.id)).order('sort_order')
        : { data: [], error: null };
      if (drinks.error) throw drinks.error;
      const rows = (drinks.data ?? []) as { edition_id: string; item_id: string }[];
      return editions.map((e) => ({
        editionId: e.id,
        name: e.name,
        barId: e.profile!.id,
        barHandle: e.profile!.handle,
        barName: e.profile!.display_name,
        dates: editionDates(e),
        drinkIds: rows.filter((r) => r.edition_id === e.id).map((r) => r.item_id),
      }));
    },
  });
}

/** Save a bar's menu to Collection, or let it go. */
export function useSaveBarMenu() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ editionId, save }: { editionId: string; save: boolean }) => {
      const { error } = save
        ? await supabase.from('saved_menu_editions').upsert({ edition_id: editionId }, { onConflict: 'user_id,edition_id', ignoreDuplicates: true })
        : await supabase.from('saved_menu_editions').delete().eq('edition_id', editionId);
      if (error) throw new Error(error.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['saved-menus'] }),
    onError: () => {},
  });
}
