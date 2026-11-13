// The takeover page both bars share (board Kept-takeover): the takeover list,
// its next night, and the guest role that ends. The run sheet itself is
// hooks/useRunSheet.ts and the links hooks/useTakeover.ts; this file only adds
// what the page reads and writes besides them, under its own keys.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { baseCapabilities, overridesFor, ROLE_PRESETS, toCapability } from '@/lib/roleMatrix';
import type { RoleMatrixRow } from '@/hooks/useVenueRoles';
import { PROFILE_COLUMNS } from '@/hooks/useLineage';
import { takeoverRoleNames } from '@/lib/takeover';
import { makerName, SHOWN_CREDITS, type ItemCredit } from '@/lib/whoMadeIt';

export interface TakeoverHead {
  id: string;
  name: string;
  barId: string | null;
  /** The guest bartenders' role at the host (menus.change_role_id): it ends, and is never an Admin's. */
  roleId: string | null;
  /** menus.run_margin_pct, the run sheet's margin on what to buy. */
  marginPct: number;
  isTakeoverList: boolean;
  /** The night this page is about: the next takeover event on the list, else its last. */
  eventId: string | null;
  startsAt: string | null;
  endsAt: string | null;
}

export const takeoverPageKey = (menuId: string) => ['takeover-page', menuId] as const;

/** The takeover list and its night. Null when the list isn't there or isn't yours to see. */
export function useTakeoverHead(menuId: string | null | undefined) {
  return useQuery({
    queryKey: takeoverPageKey(menuId ?? ''),
    enabled: !!menuId,
    queryFn: async (): Promise<TakeoverHead | null> => {
      const [menuRes, nightRes] = await Promise.all([
        supabase.from('menus').select('id, name, bar_id, list_type, change_role_id, run_margin_pct, starts_at, ends_at, planned_starts_at, planned_ends_at').eq('id', menuId!).maybeSingle(),
        // A guest bar's team may not read the host's events: the list's own dates stand in.
        supabase.from('events').select('id, starts_at, ends_at').eq('menu_id', menuId!).eq('kind', 'takeover').order('starts_at').limit(20),
      ]);
      if (menuRes.error) throw menuRes.error;
      if (nightRes.error) throw nightRes.error;
      const m = menuRes.data;
      if (!m) return null;
      const nights = nightRes.data ?? [];
      const now = Date.now();
      const night = nights.find((n) => Date.parse(n.ends_at ?? n.starts_at) > now) ?? nights[nights.length - 1] ?? null;
      return {
        id: m.id,
        name: m.name,
        barId: m.bar_id,
        roleId: m.change_role_id,
        marginPct: m.run_margin_pct,
        isTakeoverList: m.list_type === 'takeover',
        eventId: night?.id ?? null,
        startsAt: night?.starts_at ?? m.planned_starts_at ?? m.starts_at,
        endsAt: night?.ends_at ?? m.planned_ends_at ?? m.ends_at,
      };
    },
  });
}

/**
 * The takeover's guest role, made the first time someone adds a guest
 * bartender: the Takeover bartender preset (menu, specs, where things live),
 * ending `endsAt`, set as the list's change role so its holders work on it.
 * Each takeover gets its own role, named for its night (role names are
 * unique per bar, so the preset's own name would stop a second takeover).
 * Setting it on the list needs the menus permission; when that's refused the
 * role is taken away again, so nothing is left behind.
 */
export function useMakeTakeoverRole(menuId: string, barId: string | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ endsAt, matrix, startsAt, guestName }: { endsAt: string; matrix: RoleMatrixRow[]; startsAt: string | null; guestName: string | null }): Promise<string> => {
      const preset = ROLE_PRESETS.find((p) => p.id === 'takeover')!;
      const base = baseCapabilities(matrix, preset.base_level);
      const { granted, revoked } = overridesFor(base, preset.on(base));
      let roleId: string | null = null;
      for (const name of takeoverRoleNames(startsAt, guestName)) {
        const { data, error } = await supabase
          .from('venue_roles')
          .insert({ bar_id: barId!, name, base_level: preset.base_level, granted: granted.map(toCapability), revoked: revoked.map(toCapability), ends_at: endsAt })
          .select('id')
          .single();
        // 23505: another role here has that name; try the next one.
        if (error?.code === '23505') continue;
        if (error) throw error;
        roleId = data.id;
        break;
      }
      if (!roleId) throw new Error('This bar already has roles with every name this takeover could use. Rename one in Roles and try again.');
      const { data: set, error: setError } = await supabase.from('menus').update({ change_role_id: roleId }).eq('id', menuId).select('id');
      if (setError || !set?.length) {
        // No role left behind for the next try to trip over.
        await supabase.from('venue_roles').delete().eq('id', roleId);
        if (setError) throw setError;
        throw new Error('Adding guest bartenders needs the menus permission too. Ask someone who runs the menus.');
      }
      return roleId;
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: takeoverPageKey(menuId) }),
        client.invalidateQueries({ queryKey: ['role-matrix', barId] }),
      ]);
    },
    onError: () => {},
  });
}

/** Who made each drink on the list ("Mika Sato"), chosen as every row and poster does (makerName). Drinks with no credit are left out. */
export function useListMakers(itemIds: readonly string[]) {
  const ids = [...new Set(itemIds)].sort();
  return useQuery({
    queryKey: ['takeover-makers', ids],
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase
        .from('item_credits')
        .select(`item_id, id, role, what, profile_id, name, sort_order, status, disputed_at, dispute_note, profile:profiles(${PROFILE_COLUMNS})`)
        .in('item_id', ids)
        .in('status', SHOWN_CREDITS);
      if (error) throw error;
      const byItem: Record<string, ItemCredit[]> = {};
      for (const r of (data ?? []) as unknown as (ItemCredit & { item_id: string })[]) (byItem[r.item_id] ??= []).push(r);
      const out: Record<string, string> = {};
      for (const [id, credits] of Object.entries(byItem)) {
        const name = makerName(credits);
        if (name) out[id] = name;
      }
      return out;
    },
  });
}

export interface TakeoverPlace {
  key: string;
  name: string;
  /** "Walk-in, top shelf". */
  where: string;
  kind: 'house' | 'glass' | 'ice' | 'bottle';
}

/**
 * Where the list's ingredients live at the host (guest's Tonight, Keep-phone
 * guestview): each drink's spec lines and glass, then their spots in
 * item_locations. Needs the `locations` permission, which the takeover role
 * has unless its Where things live switch is off; without it, nothing.
 */
export function useTakeoverPlaces(barId: string | null | undefined, drinkIds: readonly string[]) {
  const ids = [...new Set(drinkIds)].sort();
  return useQuery({
    queryKey: ['takeover-places', barId, ids],
    enabled: !!barId && ids.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<TakeoverPlace[]> => {
      const [lines, glasses] = await Promise.all([
        supabase.from('app_recipe_presentation').select('display_ingredient(id)').in('recipe_item_id', ids),
        supabase.from('drink_glass').select('glassware_id').in('item_id', ids),
      ]);
      if (lines.error) throw lines.error;
      if (glasses.error) throw glasses.error;
      // ponytail: matched by item id, so a spec's generic line ("London dry gin") finds no spot for the host's own gin; matching by generic_id is the upgrade.
      const wanted = [...(lines.data ?? []).map((l) => l.display_ingredient?.id), ...(glasses.data ?? []).map((g) => g.glassware_id)].filter((id): id is string => !!id);
      if (!wanted.length) return [];
      const { data: spots, error: spotError } = await supabase
        .from('item_locations')
        .select('id, shelf, container, item:items!item_locations_item_id_fkey(id, name, item_type, bar_id), zone:bar_zones!item_locations_zone_id_bar_id_fkey(name)')
        .eq('bar_id', barId!)
        .in('item_id', [...new Set(wanted)])
        .order('sort_order')
        .limit(100);
      if (spotError) throw spotError;
      return (spots ?? []).flatMap((s) =>
        s.item
          ? [
              {
                key: s.id,
                name: s.item.name,
                where: [s.zone?.name, s.shelf, s.container].filter(Boolean).join(', '),
                kind: s.item.item_type === 'glassware' ? ('glass' as const) : s.item.item_type === 'ice' ? ('ice' as const) : s.item.item_type === 'ingredient' && s.item.bar_id ? ('house' as const) : ('bottle' as const),
              },
            ]
          : [],
      );
    },
  });
}
