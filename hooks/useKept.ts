import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { fetchPublished } from '@/hooks/usePublished';
import { parseHours, type WeekHours } from '@/lib/barHours';
import { editionDates, type MenuDates, type MenuEdition } from '@/lib/menuEditions';
import { supabase } from '@/lib/supabase';

/**
 * The bars and bar menus a home bartender keeps in Collection: bars they
 * love (loved_bars) and menus they saved (saved_menu_editions: a researched
 * menu by edition, or a venue's own menu by menu id). Both are
 * private to them. Plain JSON (the query cache is persisted).
 */

/** What a loved bar may tell you about (loved_bars.alerts). */
export type LoveAlerts = 'everything' | 'events' | 'menus' | 'none';

export interface LovedBar {
  id: string;
  alerts: LoveAlerts;
  handle: string | null;
  name: string;
  avatarUrl: string | null;
  place: string | null;
  /** The menu the bar is pouring now, when we know it. */
  currentMenu: { id: string; name: string; dates: MenuDates } | null;
  /** The bar's newest live release, when it has one. */
  latestRelease: { id: string; name: string; date: string } | null;
  /** For Want to go: tonight's hours and how far away it is. */
  hours: WeekHours | null;
  timezone: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface SavedMenu {
  /** The menu's id on its bar page: an edition's, or a venue's own menu's (fromVenue). */
  editionId: string;
  fromVenue: boolean;
  name: string;
  barId: string;
  barHandle: string | null;
  barName: string;
  dates: MenuDates;
  drinkIds: string[];
  /** Some of its drinks still show their specs (Open specs); otherwise names and what's in them. */
  openSpecs: boolean;
}

interface LovedRow {
  alerts: LoveAlerts;
  profile: {
    id: string;
    handle: string | null;
    display_name: string;
    avatar_url: string | null;
    locality: string | null;
    city: string | null;
    bar_id: string | null;
    hours: unknown;
    timezone: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
}

type EditionCols = Pick<MenuEdition, 'id' | 'name' | 'year' | 'month' | 'end_year' | 'end_month' | 'is_current'>;

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
        .select('alerts, profile:profiles!profile_id(id, handle, display_name, avatar_url, locality, city, bar_id, hours, timezone, latitude, longitude)')
        .order('loved_at', { ascending: false });
      if (error) throw error;
      // A bar whose page went private drops out (its profile embed comes back empty).
      const bars = ((data ?? []) as LovedRow[]).flatMap((r) => (r.profile ? [{ ...r.profile, alerts: r.alerts ?? 'everything' }] : []));
      const ids = bars.map((b) => b.id);
      const venueIds = bars.flatMap((b) => (b.bar_id ? [b.bar_id] : []));
      const [current, releases] = await Promise.all([
        ids.length
          ? supabase.from('profile_menu_editions').select('id, name, profile_id, year, month, end_year, end_month, is_current').in('profile_id', ids).eq('is_current', true)
          : { data: [], error: null },
        // Live releases only (RLS); newest first, so the first per bar is its latest.
        venueIds.length
          ? supabase.from('releases').select('id, name, release_date, bar_id').in('bar_id', venueIds).order('release_date', { ascending: false })
          : { data: [], error: null },
      ]);
      if (current.error) throw current.error;
      if (releases.error) throw releases.error;
      const menus = (current.data ?? []) as (EditionCols & { profile_id: string })[];
      const live = (releases.data ?? []) as { id: string; name: string; release_date: string; bar_id: string }[];
      return bars.map((b) => {
        const menu = menus.find((m) => m.profile_id === b.id);
        const release = b.bar_id ? live.find((r) => r.bar_id === b.bar_id) : undefined;
        return {
          id: b.id,
          alerts: b.alerts,
          handle: b.handle,
          name: b.display_name,
          avatarUrl: b.avatar_url,
          place: [b.locality, b.city].filter(Boolean).join(', ') || null,
          currentMenu: menu ? { id: menu.id, name: menu.name, dates: editionDates(menu) } : null,
          latestRelease: release ? { id: release.id, name: release.name, date: release.release_date } : null,
          hours: parseHours(b.hours),
          timezone: b.timezone,
          latitude: b.latitude,
          longitude: b.longitude,
        };
      });
    },
  });
}

/** Love a bar, or stop. */
export function useLoveBar() {
  const qc = useQueryClient();
  return useMutation({
    /** Several ids at once (a Google Maps import) are one write and one refresh. */
    mutationFn: async ({ profileId, love }: { profileId: string | string[]; love: boolean }) => {
      const ids = typeof profileId === 'string' ? [profileId] : profileId;
      const { error } = love
        ? await supabase.from('loved_bars').upsert(
            ids.map((id) => ({ profile_id: id })),
            { onConflict: 'user_id,profile_id', ignoreDuplicates: true },
          )
        : await supabase.from('loved_bars').delete().in('profile_id', ids);
      if (error) throw new Error(error.message);
    },
    // Discover's bar lists put loved bars first.
    onSettled: () => Promise.all([['loved-bars'], ['discover-top-bars'], ['discover-rankings']].map((queryKey) => qc.invalidateQueries({ queryKey }))),
    onError: () => {},
  });
}

/** Choose what a bar you love may tell you about. */
export function useSetLoveAlerts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ profileId, alerts }: { profileId: string; alerts: LoveAlerts }) => {
      const { error } = await supabase.from('loved_bars').update({ alerts }).eq('profile_id', profileId);
      if (error) throw new Error(error.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['loved-bars'] }),
    onError: () => {},
  });
}

/** Bar menus you saved, latest first, with their drinks' ids: researched menus and venues' own. */
export function useSavedMenus() {
  const userId = useUserId();
  return useQuery({
    queryKey: savedKey(userId),
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<SavedMenu[]> => {
      const [{ data, error }, venue] = await Promise.all([
        supabase
          .from('saved_menu_editions')
          .select('saved_at, edition:profile_menu_editions!edition_id(id, name, year, month, end_year, end_month, is_current, profile:profiles!profile_id(id, handle, display_name))')
          .not('edition_id', 'is', null)
          .order('saved_at', { ascending: false }),
        // A venue's own menus, as their bar pages show them (a visitor can't read menus itself).
        supabase.rpc('my_saved_venue_menus'),
      ]);
      if (error) throw error;
      if (venue.error) throw venue.error;
      const saved = (data ?? []).flatMap((r) => (r.edition?.profile ? [{ at: r.saved_at, e: r.edition }] : []));
      const editions = saved.map((r) => r.e);
      const drinks = editions.length
        ? await supabase.from('profile_menu_edition_drinks').select('edition_id, item_id').in('edition_id', editions.map((e) => e.id)).order('sort_order')
        : { data: [], error: null };
      if (drinks.error) throw drinks.error;
      const rows = (drinks.data ?? []) as { edition_id: string; item_id: string }[];
      const venueRows = (venue.data ?? []).map((v) => ({ ...v, drinkIds: ((v.drinks as { id: string }[] | null) ?? []).map((d) => d.id) }));
      // Names only unless some drink on it still shows its spec.
      const allIds = [...new Set([...rows.map((r) => r.item_id), ...venueRows.flatMap((v) => v.drinkIds)])];
      const withSpecs = new Set((await fetchPublished(allIds)).filter((p) => p.publishMode === 'spec').map((p) => p.id));
      const out: (SavedMenu & { at: string })[] = [
        ...saved.map(({ at, e }) => {
          const ids = rows.filter((r) => r.edition_id === e.id).map((r) => r.item_id);
          return {
            at,
            editionId: e.id,
            fromVenue: false,
            name: e.name,
            barId: e.profile!.id,
            barHandle: e.profile!.handle,
            barName: e.profile!.display_name,
            dates: editionDates(e),
            drinkIds: ids,
            openSpecs: ids.some((id) => withSpecs.has(id)),
          };
        }),
        ...venueRows.map((v) => ({
          at: v.saved_at,
          editionId: v.menu_id,
          fromVenue: true,
          name: v.name,
          barId: v.profile_id,
          barHandle: v.handle,
          barName: v.display_name,
          dates: editionDates(v),
          drinkIds: v.drinkIds,
          openSpecs: v.drinkIds.some((id) => withSpecs.has(id)),
        })),
      ];
      return out.sort((a, b) => b.at.localeCompare(a.at)).map(({ at: _at, ...m }) => m);
    },
  });
}

/** Save a bar's menu to Collection, or let it go. */
export function useSaveBarMenu() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ editionId, save, fromVenue = false }: { editionId: string; save: boolean; fromVenue?: boolean }) => {
      // A venue's own menu is saved by its menu id (from_venue on the bar page).
      const column = fromVenue ? 'menu_id' : 'edition_id';
      const { error } = save
        ? await supabase.from('saved_menu_editions').upsert({ [column]: editionId }, { onConflict: `user_id,${column}`, ignoreDuplicates: true })
        : await supabase.from('saved_menu_editions').delete().eq(column, editionId);
      if (error) throw new Error(error.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['saved-menus'] }),
    onError: () => {},
  });
}
