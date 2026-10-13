import { useBars } from '@/hooks/useBars';
import { effectiveRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
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
 * - Venue items: a Drink Creator (35) or above at the item's own venue, not
 *   the selected one. View-as caps the role.
 * - Shared items (no venue): their creator or a catalog admin. The client
 *   can't see catalog admins, so this asks the can_edit_item RPC. A view-as
 *   role of Bartender (30) or lower hides editing here too.
 */
export function useCanEditItem(item: { id: string; bar_id: string | null } | null | undefined) {
  const userId = useUserId();
  const barId = item?.bar_id ?? null;
  const venueRole = useEffectiveRole(barId);
  const { viewAsRoleLevel } = useViewAs();
  const shared = !!item && !barId;

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
  if (barId) return venueRole > 30;
  return canEditShared === true && (viewAsRoleLevel == null || viewAsRoleLevel > 30);
}

export function useMaxRealRole() {
  const { data: bars } = useBars();
  if (!bars?.length) return 10;
  return Math.max(...bars.map((b) => b.role_level || 10));
}
