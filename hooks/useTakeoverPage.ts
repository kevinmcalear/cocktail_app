// The takeover page both bars share (board Kept-takeover): the takeover list,
// its next night, and the guest role that ends. The run sheet itself is
// hooks/useRunSheet.ts and the links hooks/useTakeover.ts; this file only adds
// what the page reads and writes besides them, under its own keys.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { baseCapabilities, overridesFor, ROLE_PRESETS, toCapability } from '@/lib/roleMatrix';
import type { RoleMatrixRow } from '@/hooks/useVenueRoles';

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
 */
export function useMakeTakeoverRole(menuId: string, barId: string | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ endsAt, matrix }: { endsAt: string; matrix: RoleMatrixRow[] }): Promise<string> => {
      const preset = ROLE_PRESETS.find((p) => p.id === 'takeover')!;
      const base = baseCapabilities(matrix, preset.base_level);
      const { granted, revoked } = overridesFor(base, preset.on(base));
      const { data, error } = await supabase
        .from('venue_roles')
        .insert({ bar_id: barId!, name: preset.name, base_level: preset.base_level, granted: granted.map(toCapability), revoked: revoked.map(toCapability), ends_at: endsAt })
        .select('id')
        .single();
      if (error) throw error;
      const { error: setError } = await supabase.from('menus').update({ change_role_id: data.id }).eq('id', menuId);
      if (setError) {
        // No role left behind for the next try to duplicate.
        await supabase.from('venue_roles').delete().eq('id', data.id);
        throw setError;
      }
      return data.id;
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

export interface TakeoverGuest {
  menuId: string;
  /** The guest bar (the takeover's guest party), when it has one. */
  guestBar: string | null;
  /** When the guest role ends. */
  endsAt: string | null;
}

/**
 * You're a guest bartender at this bar: your role here is a takeover's, and it
 * hasn't ended. Null for the bar's own team. Tonight shows the guest's page then.
 */
export function useTakeoverGuest(barId: string | null | undefined, userId: string | null | undefined) {
  return useQuery({
    queryKey: ['takeover-guest', barId, userId],
    enabled: !!barId && !!userId,
    staleTime: 5 * 60_000,
    // Kept on the phone, so Tonight doesn't wait on it after the first load.
    meta: { persist: true },
    queryFn: async (): Promise<TakeoverGuest | null> => {
      const { data: me, error } = await supabase.from('user_bars').select('venue_role_id').eq('bar_id', barId!).eq('user_id', userId!).maybeSingle();
      if (error) throw error;
      if (!me?.venue_role_id) return null;
      const [roleRes, menuRes] = await Promise.all([
        supabase.from('venue_roles').select('ends_at').eq('id', me.venue_role_id).maybeSingle(),
        supabase.from('menus').select('id').eq('bar_id', barId!).eq('list_type', 'takeover').eq('change_role_id', me.venue_role_id).is('hidden_at', null).limit(1).maybeSingle(),
      ]);
      if (roleRes.error) throw roleRes.error;
      if (menuRes.error) throw menuRes.error;
      const endsAt = roleRes.data?.ends_at ?? null;
      if (!menuRes.data || (endsAt && Date.parse(endsAt) <= Date.now())) return null;
      const { data: party, error: partyError } = await supabase.from('menu_run_parties').select('name').eq('menu_id', menuRes.data.id).eq('kind', 'guest').order('sort_order').limit(1).maybeSingle();
      if (partyError) throw partyError;
      return { menuId: menuRes.data.id, guestBar: party?.name ?? null, endsAt };
    },
  });
}
