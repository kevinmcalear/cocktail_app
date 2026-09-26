import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/ctx/AuthContext';
import { supabase } from '@/lib/supabase';

/** What the person can do at a venue (prep, menus, locations, ...), from the server's role matrix. */
export function useCapabilities(barId: string | null | undefined) {
  const userId = useAuth().user?.id ?? null;
  return useQuery({
    queryKey: ['capabilities', barId, userId],
    enabled: !!barId && !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase.rpc('my_capabilities', { p_bar_id: barId! });
      if (error) throw error;
      return new Set((data as string[] | null) ?? []);
    },
  });
}

interface MatrixRow {
  role_id: string | null;
  base_level: number;
  capabilities: string[];
}

/**
 * The lowest base level (Guest ... Admin) that has a capability at this venue,
 * to label locked sections ("Opens at Drink Creator").
 */
export function useCapabilityOpensAt(barId: string | null | undefined, capability: string) {
  return useQuery({
    queryKey: ['capability-opens-at', barId, capability],
    enabled: !!barId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<number | null> => {
      const { data, error } = await supabase.rpc('get_venue_role_matrix', { p_bar_id: barId! });
      if (error) throw error;
      const levels = ((data as MatrixRow[] | null) ?? [])
        .filter((r) => r.role_id === null && r.capabilities.includes(capability))
        .map((r) => r.base_level);
      return levels.length ? Math.min(...levels) : null;
    },
  });
}
