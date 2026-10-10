import { useQuery } from '@tanstack/react-query';

import type { SketchGlass } from '@/lib/sketch/types';
import { supabase } from '@/lib/supabase';

// A bar's glassware (bar_glassware, supabase/migrations/20261007100000_glass_variants.sql):
// the glasses it pours into and which drawing each one is, on the bar's
// profile. Row shapes are written by hand until types/ is regenerated.

export interface BarGlass {
  id: string;
  glass: SketchGlass;
  /** A lib/sketch/geometry.ts GLASS_VARIANTS key; null is the default drawing. */
  variant: string | null;
  name: string | null;
  maker: string | null;
  /** The maker's page, when the glass names one (20261012430000). */
  maker_page: { handle: string; display_name: string } | null;
  designer: string | null;
  series: string | null;
  shape_note: string | null;
  source_urls: string[];
  /** The glass of its type the bar's drinks are drawn in. */
  is_default: boolean;
  /** The bar's name, for "Little Rye uses this". */
  bar_name: string;
}

/** A venue's glasses (through its profile), in its order. Pass null to skip. */
export function useBarGlassware(barId: string | null | undefined) {
  return useQuery({
    queryKey: ['bar-glassware', barId],
    enabled: !!barId,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<BarGlass[]> => {
      const { data, error } = await supabase
        .from('bar_glassware')
        .select(
          'id, glass, variant, name, maker, designer, series, shape_note, source_urls, is_default, profiles:profiles!bar_glassware_profile_id_fkey!inner(bar_id, display_name), maker_page:profiles!bar_glassware_maker_profile_id_fkey(handle, display_name)'
        )
        .eq('profiles.bar_id', barId!)
        .order('sort_order')
        .order('created_at');
      if (error) throw error;
      type Row = Omit<BarGlass, 'bar_name'> & { profiles: { display_name: string } | null };
      return ((data ?? []) as unknown as Row[]).map(({ profiles, ...row }) => ({ ...row, bar_name: profiles?.display_name ?? '' }));
    },
  });
}

/** The bar's default glass of a type, if it has one. */
export const barGlassFor = (rows: readonly BarGlass[] | undefined, glass: SketchGlass) => rows?.find((r) => r.glass === glass && r.is_default) ?? null;
