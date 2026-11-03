import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export interface VenueBrandRow {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  /** A venue_display_face value; one this build doesn't know reads as Redaction, an older one as the nearest face (lib/brand faceFromDb). */
  display_face: string;
  ground_tint: string | null;
  short_name: string | null;
  icon_url: string | null;
  /** The home-screen icon's background: 'accent', 'ground' or 'cream', or null for the logo's own colour. */
  icon_background: 'accent' | 'ground' | 'cream' | null;
}

const COLUMNS = 'id, name, slug, logo_url, primary_color, secondary_color, display_face, ground_tint, short_name, icon_url, icon_background';

/** A venue's brand: logo, accent, display face, dark ground tint, home-screen icon and short name. */
export function useVenueBrand(barId: string | null | undefined) {
  return useQuery({
    queryKey: ['venue-brand', barId],
    enabled: !!barId,
    queryFn: async (): Promise<VenueBrandRow> => {
      const { data, error } = await supabase.from('bars').select(COLUMNS).eq('id', barId!).single();
      if (error) throw error;
      return data as VenueBrandRow;
    },
  });
}
