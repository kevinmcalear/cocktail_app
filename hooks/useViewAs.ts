import { useBars } from '@/hooks/useBars';
import { useCapabilities } from '@/hooks/useCapabilities';
import { effectiveRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import { canManageTeam } from '@/lib/team';
import { useUserId } from '@/ctx/AuthContext';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

async function fetchViewAs(): Promise<number | null> {
  const { data, error } = await supabase
    .from('user_prefs')
    .select('view_as_role_level')
    .maybeSingle();
  if (error) throw error;
  return data?.view_as_role_level ?? null;
}

/**
 * The role you're previewing as, if any. `fresh` treats the saved copy as
 * stale, so it's checked again once signed in: the banner (mounted once per
 * load) passes it, since the cache saves every 5 seconds and a reload right
 * after turning View as on would otherwise restore the old value for its 15
 * minutes. (refetchOnMount isn't enough: the query mounts disabled until the
 * user id is known, and enabling it refetches only a stale query.)
 */
export function useViewAs({ fresh = false }: { fresh?: boolean } = {}) {
  const userId = useUserId();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['viewAs', userId],
    queryFn: fetchViewAs,
    enabled: !!userId,
    // Spread, not `staleTime: undefined`, which would override the tier's 15 minutes.
    ...(fresh ? { staleTime: 0 } : {}),
  });

  const mutation = useMutation({
    mutationFn: async (level: number | null) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase.from('user_prefs').upsert({
        user_id: userId,
        view_as_role_level: level,
      });
      if (error) throw error;
      return level;
    },
    onSuccess: async (level) => {
      queryClient.setQueryData(['viewAs', userId], level);
      // Presentation views read view-as from user_prefs: drop cached lists/details.
      await queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[0] !== 'viewAs',
      });
    },
  });

  return {
    viewAsRoleLevel: query.data ?? null,
    setViewAsRoleLevel: mutation.mutateAsync,
    isLoading: query.isLoading,
    isSaving: mutation.isPending,
  };
}

/** Effective role at this venue under view-as (no venue: a guest's). */
export function useEffectiveRole(barId: string | null) {
  const { data: bars } = useBars();
  const { viewAsRoleLevel } = useViewAs();
  const real = (barId ? bars?.find((b) => b.bar_id === barId)?.role_level : undefined) ?? 10;
  return effectiveRole(real, viewAsRoleLevel);
}

/**
 * Whether to offer editing an item, following the items RLS rule
 * (private.can_write).
 *
 * - Venue items: the create and edit drinks permission at the item's own
 *   venue, not the selected one (any role the venue gives it). Under View as,
 *   the previewed built-in role decides.
 * - Shared items (no venue): their creator, a Drink Creator or above at the
 *   bar a drink is credited to, or a catalog admin. The client can't see
 *   catalog admins or credits, so this asks the can_edit_item RPC. A view-as
 *   role of Bartender (30) or lower hides editing here too.
 */
export function useCanEditItem(item: { id: string; bar_id: string | null } | null | undefined) {
  const userId = useUserId();
  const barId = item?.bar_id ?? null;
  const venueRole = useEffectiveRole(barId);
  const { viewAsRoleLevel } = useViewAs();
  const shared = !!item && !barId;
  const caps = useCapabilities(barId).data;

  const { data: canEditShared } = useQuery({
    queryKey: ['canEditItem', item?.id, userId],
    enabled: shared && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('can_edit_item', { p_item_id: item!.id });
      if (error) throw error;
      return data === true;
    },
  });

  if (!item) return false;
  if (barId) return viewAsRoleLevel == null && caps ? caps.includes('edit_drinks') : venueRole > 30;
  return canEditShared === true && (viewAsRoleLevel == null || viewAsRoleLevel > 30);
}

/**
 * Whether to offer inviting, changing roles and removing people at a venue:
 * the staff permission, which an Admin always has and a venue can give any
 * role. Under View as, the previewed built-in role decides.
 */
export function useCanManageStaff(barId: string | null | undefined): boolean {
  const caps = useCapabilities(barId).data;
  const role = useEffectiveRole(barId ?? null);
  const { viewAsRoleLevel } = useViewAs();
  if (!barId) return false;
  return viewAsRoleLevel == null && caps ? caps.includes('staff') : canManageTeam(role);
}

export function useMaxRealRole() {
  const { data: bars } = useBars();
  if (!bars?.length) return 10;
  return Math.max(...bars.map((b) => b.role_level || 10));
}
