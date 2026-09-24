import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export interface VenueBranding {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
}

/** A venue's public name, logo and colours, by its staff-link slug. Works signed out. */
export function useVenueBranding(slug: string | undefined) {
  return useQuery({
    queryKey: ['venue-branding', slug],
    enabled: !!slug,
    staleTime: 5 * 60_000,
    // Kept when a user signs out (see clearUserData): the signed-out staff-link page needs it.
    meta: { public: true },
    queryFn: async (): Promise<VenueBranding | null> => {
      const { data, error } = await supabase.rpc('get_venue_branding', { p_slug: slug! }).maybeSingle();
      if (error) throw error;
      return (data as VenueBranding | null) ?? null;
    },
  });
}
