import { queryOptions, useQuery } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import type { RoleMatrixRow } from '@/hooks/useVenueRoles';
import { supabase } from '@/lib/supabase';

/**
 * What the person can do at a venue (prep, menus, locations, ...), from the
 * server's role matrix. An array, not a Set: the query cache is persisted to
 * storage, and a Set comes back from JSON as a plain object.
 */
export function useCapabilities(barId: string | null | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['capabilities', barId, userId],
    enabled: !!barId && !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.rpc('my_capabilities', { p_bar_id: barId! });
      if (error) throw error;
      return (data as string[] | null) ?? [];
    },
  });
}

/** A venue's role matrix as one query, shared by Roles and the drink page's locked-section labels (useSpecLevels, useCapabilityOpensAt). */
export const roleMatrixQuery = (barId: string) =>
  queryOptions({
    queryKey: ['role-matrix', barId],
    staleTime: 60_000,
    queryFn: async (): Promise<RoleMatrixRow[]> => {
      const { data, error } = await supabase.rpc('get_venue_role_matrix', { p_bar_id: barId });
      if (error) throw error;
      return (data as RoleMatrixRow[] | null) ?? [];
    },
  });

/**
 * The lowest base level (Guest ... Admin) that has a capability at this venue,
 * to label locked sections ("Opens at Drink Creator").
 */
export function useCapabilityOpensAt(barId: string | null | undefined, capability: string) {
  return useQuery({
    queryKey: ['capability-opens-at', barId, capability],
    enabled: !!barId,
    staleTime: 5 * 60_000,
    queryFn: async ({ client }): Promise<number | null> => {
      // The matrix is one query for the page (useSpecLevels reads it too).
      const levels = (await client.fetchQuery(roleMatrixQuery(barId!)))
        .filter((r) => r.role_id === null && r.capabilities.includes(capability))
        .map((r) => r.base_level);
      return levels.length ? Math.min(...levels) : null;
    },
  });
}
