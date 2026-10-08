import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';

import { useUserId } from '@/ctx/AuthContext';
import { DROPDOWNS_QUERY_KEY } from '@/hooks/useDropdowns';
import { uploadMenuCover } from '@/hooks/useMenuEditor';
import { MENU_DRINK_COLUMNS, menuKeys, publishedMenuDrink, toMenuDrink, type MenuItemRow } from '@/hooks/useMenus';
import { fetchPublished } from '@/hooks/usePublished';
import { savePayload, type EditSection, type MenuLayout } from '@/lib/menuLayout';
import { readMenuPhotos } from '@/lib/readMenu';
import { normalizeAllowedTypes } from '@/lib/sectionAllowedTypes';
import { supabase } from '@/lib/supabase';
import type { MenuDrink } from '@/types/menus';

/** A database error, said the way a person would want to hear it. */
function readable(error: { code?: string; message: string }): Error {
  if (error.code === '42501') return new Error('You can’t change this menu. Ask someone who builds menus at this venue.');
  return new Error(error.message.charAt(0).toUpperCase() + error.message.slice(1));
}

async function rpc(fn: string, args: Record<string, unknown>) {
  const { error } = await supabase.rpc(fn, args);
  if (error) throw readable(error);
}

function useInvalidateMenus() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: menuKeys.all }),
      // Tonight, Prep, Study and the legacy screens still read menus from here.
      queryClient.invalidateQueries({ queryKey: DROPDOWNS_QUERY_KEY }),
    ]);
}

/** Saves a menu's name, cover and whole layout in one transaction (save_menu). */
export function useSaveMenu(menuId: string) {
  const invalidate = useInvalidateMenus();
  return useMutation({
    mutationFn: (layout: MenuLayout) =>
      rpc('save_menu', {
        p_menu_id: menuId,
        p_name: layout.name,
        p_cover_url: layout.coverUrl,
        p_cover_position: layout.coverPosition,
        p_sections: savePayload(layout),
      }),
    onSuccess: invalidate,
    onError: () => {},
  });
}

/** A home menu's night: the date and how many are coming. */
export interface HomeNight {
  menuDate: string | null;
  guestCount: number | null;
}

/**
 * A new draft menu: a venue's (or yours, with no venue, maybe with a date and
 * a guest count), with its first layout. Returns the new menu's id.
 */
export function useCreateMenu() {
  const invalidate = useInvalidateMenus();
  const userId = useUserId();
  return useMutation({
    mutationFn: async ({ barId, layout, night }: { barId: string | null; layout: MenuLayout; night?: HomeNight }): Promise<string> => {
      const { data, error } = await supabase
        .from('menus')
        .insert({
          name: layout.name.trim(),
          bar_id: barId,
          created_by: userId,
          cover_url: layout.coverUrl,
          cover_position: layout.coverPosition,
          menu_date: night?.menuDate ?? null,
          guest_count: night?.guestCount ?? null,
        })
        .select('id')
        .single();
      if (error) throw readable(error);
      try {
        await rpc('save_menu', {
          p_menu_id: data.id,
          p_name: layout.name,
          p_cover_url: layout.coverUrl,
          p_cover_position: layout.coverPosition,
          p_sections: savePayload(layout),
        });
      } catch (e) {
        // Don't leave an empty menu behind when its layout didn't save.
        await supabase.from('menus').delete().eq('id', data.id);
        throw e;
      }
      return data.id as string;
    },
    onSuccess: invalidate,
    onError: () => {},
  });
}

/** Puts a menu on now or on a date, ending the menus it replaces then (schedule_menu). */
export function useScheduleMenu() {
  const invalidate = useInvalidateMenus();
  return useMutation({
    mutationFn: ({ menuId, startsAt, replaceIds }: { menuId: string; startsAt: string | null; replaceIds: string[] }) =>
      rpc('schedule_menu', { p_menu_id: menuId, p_starts_at: startsAt, p_replace_menu_ids: replaceIds }),
    onSuccess: invalidate,
    onError: () => {},
  });
}

/** Takes a menu off now; one that hasn't started goes back to being a draft (end_menu). */
export function useEndMenu() {
  const invalidate = useInvalidateMenus();
  return useMutation({
    mutationFn: (menuId: string) => rpc('end_menu', { p_menu_id: menuId }),
    onSuccess: invalidate,
    onError: () => {},
  });
}

/**
 * Shares a home menu with a link (/m/<id>), or stops sharing it. The server
 * sets the time, and refuses without a public profile. No drink's visibility
 * changes: the link shows only drinks that are already public.
 */
export function useShareMenu() {
  const invalidate = useInvalidateMenus();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ menuId, shared }: { menuId: string; shared: boolean }) => {
      const { error } = await supabase.from('menus').update({ shared_at: shared ? new Date().toISOString() : null }).eq('id', menuId);
      if (error) throw readable(error);
    },
    onSuccess: () => Promise.all([invalidate(), queryClient.invalidateQueries({ queryKey: ['published', 'menu'] })]),
    onError: () => {},
  });
}

/** Changes a home menu's date or guest count. */
export function useSetHomeNight() {
  const invalidate = useInvalidateMenus();
  return useMutation({
    mutationFn: async ({ menuId, night }: { menuId: string; night: HomeNight }) => {
      const { error } = await supabase.from('menus').update({ menu_date: night.menuDate, guest_count: night.guestCount }).eq('id', menuId);
      if (error) throw readable(error);
    },
    onSuccess: invalidate,
    onError: () => {},
  });
}

export function useDeleteMenu() {
  const invalidate = useInvalidateMenus();
  return useMutation({
    mutationFn: async (menuId: string) => {
      const { error, count } = await supabase.from('menus').delete({ count: 'exact' }).eq('id', menuId);
      if (error) throw readable(error);
      if (!count) throw new Error('You can’t delete this menu.');
    },
    onSuccess: invalidate,
    onError: () => {},
  });
}

/** Keeps a menu's sections as a layout for next time (a menu template). */
export function useSaveLayout() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async ({ name, sections }: { name: string; sections: EditSection[] }) => {
      const { data, error } = await supabase.from('menu_templates').insert({ name: name.trim(), created_by: userId }).select('id').single();
      if (error) throw readable(error);
      const { error: sectionsError } = await supabase.from('template_sections').insert(
        sections.map((s, i) => ({
          template_id: data.id,
          name: s.name.trim(),
          sort_order: i,
          min_items: s.minItems,
          max_items: s.maxItems,
          allowed_types: s.allowedTypes,
        }))
      );
      if (sectionsError) {
        await supabase.from('menu_templates').delete().eq('id', data.id);
        throw readable(sectionsError);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['menu-layouts'] }),
    onError: () => {},
  });
}

export interface MenuLayoutTemplate {
  id: string;
  name: string;
  sections: Omit<EditSection, 'key' | 'id'>[];
}

/**
 * Saved layouts (menu templates) to start a menu from: yours, and the ones
 * the venue's menus use. Templates are shared app-wide, so not every one.
 */
export function useMenuLayouts(barId: string | null) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['menu-layouts', barId, userId],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<MenuLayoutTemplate[]> => {
      const used = barId ? await supabase.from('menus').select('template_id').eq('bar_id', barId).not('template_id', 'is', null) : { data: [], error: null };
      if (used.error) throw used.error;
      const ids = [...new Set((used.data ?? []).map((m) => m.template_id as string))];
      const scope = ids.length ? `created_by.eq.${userId},id.in.(${ids.join(',')})` : `created_by.eq.${userId}`;
      const { data, error } = await supabase
        .from('menu_templates')
        .select('id, name, template_sections(name, sort_order, min_items, max_items, allowed_types)')
        .or(scope)
        .order('name');
      if (error) throw error;
      return (data ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        sections: [...(t.template_sections ?? [])]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((s) => ({
            name: s.name,
            minItems: s.min_items ?? 1,
            maxItems: s.max_items ?? null,
            allowedTypes: normalizeAllowedTypes(s.allowed_types),
            drinks: [],
          })),
      }));
    },
  });
}

/**
 * The drinks a menu can use: the venue's cocktails, beer and wine (or, for a
 * menu with no venue, the drinks you collected from bars, then yours and the
 * shared classics), newest first.
 */
export function useMenuLibrary(barId: string | null | undefined, enabled = true) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['menu-library', barId ?? null, userId],
    enabled: enabled && !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<MenuDrink[]> => {
      // ponytail: one page of up to 500 drinks. A venue's list is a few
      // hundred at most; move to search-as-you-type if one outgrows it.
      const query = supabase
        .from('items')
        .select(MENU_DRINK_COLUMNS)
        .in('item_type', ['cocktail', 'beer', 'wine'])
        .order('created_at', { ascending: false })
        .limit(500);
      const { data, error } = barId
        ? await query.eq('bar_id', barId)
        : await query.is('bar_id', null).or(`created_by.eq.${userId},is_catalog.eq.true`);
      if (error) throw error;
      const own = ((data ?? []) as unknown as MenuItemRow[]).map(toMenuDrink).filter((d): d is MenuDrink => !!d);
      if (barId) return own;
      // At home, the drinks you collected from bars too, while they're published.
      const collected = await supabase.from('collected_items').select('item_id').not('item_id', 'is', null).order('collected_at', { ascending: false });
      if (collected.error) throw collected.error;
      const ids = collected.data.map((c) => c.item_id as string).filter((id) => !own.some((d) => d.id === id));
      const fromBars = (await fetchPublished(ids)).map(publishedMenuDrink).filter((d): d is MenuDrink => !!d);
      return [...fromBars, ...own];
    },
  });
}

/**
 * Picks a cover from the photo library (5:2, like the legacy editor) and
 * uploads it. Resolves null when the person cancels.
 */
export function usePickMenuCover(menuId: string) {
  return useMutation({
    mutationFn: async (): Promise<string | null> => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') throw new Error('Allow access to your photos to choose a cover.');
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [5, 2], quality: 0.85 });
      if (result.canceled || !result.assets?.length) return null;
      return uploadMenuCover(result.assets[0].uri, menuId);
    },
    onError: () => {},
  });
}

/** Reads photos of a printed menu (read-menu): one AI unit a call. */
export function useReadMenu() {
  return useMutation({ mutationFn: readMenuPhotos, onError: () => {} });
}

/** Uploads a local photo as a new menu's cover; resolves its public URL. */
export function useUploadMenuCover() {
  return useMutation({ mutationFn: (uri: string) => uploadMenuCover(uri, null), onError: () => {} });
}
