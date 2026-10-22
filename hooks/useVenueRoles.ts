import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { withToggle } from '@/lib/roleMatrix';
import { supabase } from '@/lib/supabase';

/**
 * One column of the roles matrix (get_venue_role_matrix): a base level when
 * `role_id` is null, else one of the venue's own roles. `capabilities` is what
 * it can do at this venue, worked out by the database, so the app never
 * re-implements the rules.
 */
export interface RoleMatrixRow {
  role_id: string | null;
  name: string | null;
  base_level: number;
  ends_at: string | null;
  granted: string[];
  revoked: string[];
  capabilities: string[];
  /** What it could do before anyone changed it: the built-in role at this venue. */
  starts_with?: string[];
}

/** The five base levels and the venue's own roles, for members of the venue. */
export function useRoleMatrix(barId: string | null | undefined) {
  return useQuery({
    queryKey: ['role-matrix', barId],
    enabled: !!barId,
    staleTime: 60_000,
    queryFn: async (): Promise<RoleMatrixRow[]> => {
      const { data, error } = await supabase.rpc('get_venue_role_matrix', { p_bar_id: barId! });
      if (error) throw error;
      return (data as RoleMatrixRow[] | null) ?? [];
    },
  });
}

/** What a venue role is made of, for New role and Edit role. */
export interface VenueRoleDraft {
  id?: string;
  name: string;
  base_level: number;
  granted: string[];
  revoked: string[];
  ends_at: string | null;
}

function useInvalidateRoles(barId: string | null | undefined) {
  const client = useQueryClient();
  return async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['role-matrix', barId] }),
      client.invalidateQueries({ queryKey: ['bar', barId] }),
      client.invalidateQueries({ queryKey: ['bar-members', barId] }),
      client.invalidateQueries({ queryKey: ['capabilities', barId] }),
      client.invalidateQueries({ queryKey: ['capability-opens-at', barId] }),
    ]);
  };
}

/**
 * Makes or changes one of the venue's roles. The venue_roles policies let
 * only people with staff; the database refuses Admin roles with an end date
 * or without staff. Changing the base level moves everyone
 * holding the role (a trigger).
 */
export function useSaveVenueRole(barId: string | null | undefined) {
  const invalidate = useInvalidateRoles(barId);
  return useMutation({
    mutationFn: async ({ id, ...role }: VenueRoleDraft) => {
      const row = { ...role, name: role.name.trim() };
      const { error } = id
        ? await supabase.from('venue_roles').update(row).eq('id', id).eq('bar_id', barId!)
        : await supabase.from('venue_roles').insert({ ...row, bar_id: barId! });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => {},
  });
}

/** One dot on Roles and access: a permission for a venue role (roleId) or a built-in one (level). */
export interface RoleToggle {
  roleId: string | null;
  level: number;
  capability: string;
  on: boolean;
}

/**
 * Switches one permission for one role at the venue (set_role_capability),
 * showing it at once and putting it back if the database refuses. Only people
 * with staff may; an Admin always keeps staff; someone with staff who isn't
 * an Admin can't touch Admin roles or hand out what they can't do.
 */
export function useSetRoleCapability(barId: string | null | undefined) {
  const client = useQueryClient();
  const invalidate = useInvalidateRoles(barId);
  return useMutation({
    mutationFn: async ({ roleId, level, capability, on }: RoleToggle) => {
      const { error } = await supabase.rpc('set_role_capability', {
        p_bar_id: barId!, p_role_id: roleId, p_level: roleId ? null : level, p_capability: capability, p_on: on,
      });
      if (error) throw error;
    },
    onMutate: async ({ roleId, level, capability, on }) => {
      await client.cancelQueries({ queryKey: ['role-matrix', barId] });
      const before = client.getQueryData<RoleMatrixRow[]>(['role-matrix', barId]);
      if (before) client.setQueryData(['role-matrix', barId], withToggle(before, { role_id: roleId, base_level: level }, capability, on));
      return { before };
    },
    onError: (_e, _v, context) => {
      if (context?.before) client.setQueryData(['role-matrix', barId], context.before);
    },
    // Not awaited: the toast and its Undo show as soon as the database says yes.
    onSettled: () => void invalidate(),
  });
}

/** Reset to built in: drops the venue's changes to a built-in role. */
export function useResetBuiltInRole(barId: string | null | undefined) {
  const invalidate = useInvalidateRoles(barId);
  return useMutation({
    mutationFn: async (level: number) => {
      const { error } = await supabase.from('venue_level_overrides').delete().eq('bar_id', barId!).eq('base_level', level);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => {},
  });
}

/** Deletes a venue role. Its members keep their base level (the foreign key sets their role to none). */
export function useDeleteVenueRole(barId: string | null | undefined) {
  const invalidate = useInvalidateRoles(barId);
  return useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase.from('venue_roles').delete().eq('id', roleId).eq('bar_id', barId!);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => {},
  });
}

/** A role to give a member: a base level, or one of the venue's own roles. */
export type MemberRoleChoice = { level: number } | { venueRoleId: string };

/**
 * Gives a member a base level or a venue role. People with staff only (user_bars_update);
 * the database copies a venue role's base level onto the member, keeps the
 * venue's last Admin, and stamps role_since.
 */
export function useSetMemberRoleChoice(barId: string | null | undefined) {
  const invalidate = useInvalidateRoles(barId);
  return useMutation({
    mutationFn: async ({ userId, choice }: { userId: string; choice: MemberRoleChoice }) => {
      const patch = 'level' in choice ? { role_level: choice.level, venue_role_id: null } : { venue_role_id: choice.venueRoleId };
      const { error } = await supabase.from('user_bars').update(patch).eq('bar_id', barId!).eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => {},
  });
}

/**
 * The venue's own bar profile id (public or not), where its facts live:
 * hours, phone, website (hooks/useBarFacts). Null when it has none yet.
 */
export function useVenueProfileId(barId: string | null | undefined) {
  return useQuery({
    queryKey: ['venue-profile-id', barId],
    enabled: !!barId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.from('profiles').select('id').eq('bar_id', barId!).eq('kind', 'bar').limit(1).maybeSingle();
      if (error) throw error;
      return (data as { id: string } | null)?.id ?? null;
    },
  });
}
