import { useBars } from '@/hooks/useBars';
import { effectiveRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';
import { useAuth } from '@/ctx/AuthContext';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

async function fetchViewAs(): Promise<number | null> {
  const { data, error } = await supabase
    .from('user_prefs')
    .select('view_as_role_level')
    .maybeSingle();
  if (error) throw error;
  return data?.view_as_role_level ?? null;
}

export function useViewAs() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['viewAs', user?.id],
    queryFn: fetchViewAs,
    enabled: !!user,
  });

  const mutation = useMutation({
    mutationFn: async (level: number | null) => {
      if (!user) throw new Error('Not signed in');
      const { error } = await supabase.from('user_prefs').upsert({
        user_id: user.id,
        view_as_role_level: level,
      });
      if (error) throw error;
      return level;
    },
    onSuccess: async (level) => {
      queryClient.setQueryData(['viewAs', user?.id], level);
      // Presentation views read view-as from user_prefs — drop cached lists/details.
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

/** Effective role for the selected (or given) venue under view-as. */
export function useEffectiveRole(barId?: string | null) {
  const selectedBarId = useAppStore((s) => s.selectedBarId);
  const { data: bars } = useBars();
  const { viewAsRoleLevel } = useViewAs();
  const id = barId === undefined ? selectedBarId : barId;
  const real = bars?.find((b) => b.bar_id === id)?.role_level ?? 10;
  return effectiveRole(real, viewAsRoleLevel);
}

export function useMaxRealRole() {
  const { data: bars } = useBars();
  if (!bars?.length) return 10;
  return Math.max(...bars.map((b) => b.role_level || 10));
}
