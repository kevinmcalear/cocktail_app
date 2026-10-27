// A bar's menu editions, and the menus a drink was on (menu_drink_runs) and who's credited.
// Split out of hooks/useProfiles.ts, which still re-exports it.
import { useQuery } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { MENU_DRINK_COLUMNS, toMenuDrink, type MenuItemRow } from '@/hooks/useMenus';
import { viewerScoped } from '@/lib/authCache';
import type { DrinkRun } from '@/lib/findYourself';
import { runDates, sortEditions, type MenuDates, type MenuEdition, type MenuEditionDrink, type MenuRunRow } from '@/lib/menuEditions';
import { groupMenuCredits, type MenuCredit, type MenuDrinkRow } from '@/lib/profiles';
import { jsonAs, supabase } from '@/lib/supabase';
import type { MenuDrink } from '@/types/menus';

/** Every cocktail menu a bar has put out, newest first. */
export function useMenuEditions(profileId: string | null | undefined) {
  return useQuery({
    queryKey: ['profile-menu-editions', profileId],
    enabled: !!profileId,
    queryFn: async (): Promise<MenuEdition[]> => {
      const { data, error } = await supabase.rpc('get_menu_editions', { p_profile_id: profileId! });
      if (error) throw error;
      return sortEditions((data ?? []).map((e) => ({ ...e, drinks: jsonAs<MenuEditionDrink[]>(e.drinks) })));
    },
  });
}

export interface DrinkMenuRun extends MenuDates {
  barId: string;
  barName: string;
  /** The menu to open: the one on now, else the latest it was on. */
  editionId: string;
  editionName: string;
}

/** The bar menus a drink was on, and when (menu_drink_runs). Empty for a drink no menu lists. */
export function useDrinkMenuRuns(itemId: string | null) {
  const viewer = viewerScoped(useUserId());
  return useQuery({
    queryKey: ['drink-menu-runs', itemId, viewer.key],
    meta: viewer.meta,
    enabled: !!itemId,
    queryFn: async (): Promise<DrinkMenuRun[]> => {
      const { data, error } = await supabase
        .from('menu_drink_runs')
        .select('profile_id, edition_id, edition_name, start_year, start_month, end_year, end_month, is_current')
        .eq('item_id', itemId!);
      if (error) throw error;
      const rows = (data ?? []) as (MenuRunRow & { profile_id: string; edition_id: string; edition_name: string })[];
      if (!rows.length) return [];
      const bars = await supabase.from('profiles').select('id, display_name').in('id', rows.map((r) => r.profile_id));
      if (bars.error) throw bars.error;
      const names = new Map((bars.data ?? []).map((b) => [b.id as string, b.display_name as string]));
      return rows.map((r) => ({ ...runDates(r), barId: r.profile_id, barName: names.get(r.profile_id) ?? 'A bar', editionId: r.edition_id, editionName: r.edition_name }));
    },
  });
}

/** Every bar menu these drinks were on, and when (menu_drink_runs): a person's "Made by" (find-yourself). */
export function useMenuRuns(itemIds: readonly string[]) {
  const viewer = viewerScoped(useUserId());
  const ids = [...new Set(itemIds)].sort();
  return useQuery({
    queryKey: ['menu-runs', ids, viewer.key],
    meta: viewer.meta,
    enabled: ids.length > 0,
    queryFn: async (): Promise<DrinkRun[]> => {
      const { data, error } = await supabase
        .from('menu_drink_runs')
        .select('item_id, profile_id, edition_id, edition_name, start_year, end_year, is_current')
        .in('item_id', ids)
        .limit(1000);
      if (error) throw error;
      return ((data ?? []) as { item_id: string; profile_id: string; edition_id: string; edition_name: string; start_year: number; end_year: number | null; is_current: boolean }[]).map((r) => ({
        itemId: r.item_id,
        barId: r.profile_id,
        editionId: r.edition_id,
        editionName: r.edition_name,
        startYear: r.start_year,
        endYear: r.end_year,
        isCurrent: r.is_current,
      }));
    },
  });
}

/**
 * The drinks on a menu edition with their ingredients and pictures, for
 * signed-in readers. Signed out, a bar's own drinks aren't readable, so the
 * menu shows their names (lib/menuEditions editionMenuDrinks).
 */
export function useMenuEditionDrinks(drinks: MenuEditionDrink[]) {
  const userId = useUserId();
  const ids = drinks.map((d) => d.id);
  return useQuery({
    queryKey: ['menu-edition-drinks', ids, userId],
    enabled: !!userId && ids.length > 0,
    queryFn: async (): Promise<MenuDrink[]> => {
      const { data, error } = await supabase.from('items').select(MENU_DRINK_COLUMNS).in('id', ids);
      if (error) throw error;
      // ponytail: supabase-js can't type an embed on items' own foreign keys ("more than one relationship"), so the row is cast; hint it as items!<fk> to drop this.
      return ((data ?? []) as unknown as MenuItemRow[]).map((row) => toMenuDrink(row)).filter((d): d is MenuDrink => !!d);
    },
  });
}

export interface MenuCreditWithProfile extends MenuCredit {
  /** The bar's public profile, to link to, when it has one. */
  barProfileId: string | null;
}

/**
 * Where these drinks are on bar menus: the credit that matters most.
 * ponytail: menus are readable by the bar's own members only, so a visitor
 * sees the menus of bars they work at. Showing every bar needs a public
 * "on the menu at" read from the publishing piece (7d).
 */
export function useMenuCredits(itemIds: string[]) {
  const viewer = viewerScoped(useUserId());
  return useQuery({
    queryKey: ['menu-credits', itemIds, viewer.key],
    meta: viewer.meta,
    enabled: itemIds.length > 0,
    queryFn: async (): Promise<MenuCreditWithProfile[]> => {
      const { data, error } = await supabase
        .from('menu_drinks')
        .select('item_id, menu:menus(id, name, is_active, bar_id, bar:bars(name))')
        .in('item_id', itemIds);
      if (error) throw error;
      const credits = groupMenuCredits((data ?? []) as MenuDrinkRow[]);
      const barIds = [...new Set(credits.map((c) => c.barId).filter((id): id is string => !!id))];
      const profiles = barIds.length ? await supabase.from('profiles').select('id, bar_id').in('bar_id', barIds) : { data: [], error: null };
      if (profiles.error) throw profiles.error;
      const byBar = new Map((profiles.data ?? []).map((p) => [p.bar_id as string, p.id as string]));
      return credits.map((c) => ({ ...c, barProfileId: (c.barId && byBar.get(c.barId)) || null }));
    },
  });
}
