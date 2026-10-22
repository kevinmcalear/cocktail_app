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
 * - Shared items (no venue): their creator, a Drink Creator or above at the
 *   bar a drink is credited to, or a catalog admin. The client can't see
 *   catalog admins or credits, so this asks the can_edit_item RPC. A view-as
 *   role of Bartender (30) or lower hides editing here too.
 *
 * 'edit' is the drink's own people: its page shows Edit and its pencils.
 * 'admin' is a catalog admin on someone else's drink: the page stays a
 * visitor's, with one Fix as admin in More (Kevin, 22 Oct).
 */
export function useItemEditAccess(item: { id: string; bar_id: string | null } | null | undefined): 'edit' | 'admin' | null {
  const userId = useUserId();
  const { data: bars } = useBars();
  const barId = item?.bar_id ?? null;
  const venueRole = useEffectiveRole(barId);
  const { viewAsRoleLevel } = useViewAs();
  const shared = !!item && !barId;

  const { data: sharedAccess } = useQuery({
    queryKey: ['itemEditAccess', item?.id, userId],
    enabled: shared && !!userId,
    queryFn: async (): Promise<{ creator: boolean; creditedBarId: string | null } | null> => {
      const { data, error } = await supabase.rpc('can_edit_item', { p_item_id: item!.id });
      if (error) throw error;
      if (data !== true) return null;
      // The RPC can't say why, so read who it belongs to: its creator, or the bar it's credited to.
      const { data: row, error: rowError } = await supabase
        .from('items')
        .select('created_by, origin_bar:profiles!items_origin_bar_profile_id_fkey(bar_id)')
        .eq('id', item!.id)
        .maybeSingle();
      if (rowError) throw rowError;
      const origin = row?.origin_bar as unknown as { bar_id: string | null } | null;
      return { creator: !!row && row.created_by === userId, creditedBarId: origin?.bar_id ?? null };
    },
  });

  if (!item) return null;
  if (barId) return venueRole > 30 ? 'edit' : null;
  if (!sharedAccess || (viewAsRoleLevel != null && viewAsRoleLevel <= 30)) return null;
  const creditedRole = bars?.find((b) => b.bar_id === sharedAccess.creditedBarId)?.role_level ?? 10;
  return sharedAccess.creator || creditedRole >= 35 ? 'edit' : 'admin';
}

/** Whether the viewer may edit the item at all, as its own people or as a catalog admin. */
export function useCanEditItem(item: { id: string; bar_id: string | null } | null | undefined) {
  return useItemEditAccess(item) !== null;
}

export function useMaxRealRole() {
  const { data: bars } = useBars();
  if (!bars?.length) return 10;
  return Math.max(...bars.map((b) => b.role_level || 10));
}
