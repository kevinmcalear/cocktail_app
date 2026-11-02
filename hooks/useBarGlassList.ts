import { useQuery } from '@tanstack/react-query';

import { GLASS_MODEL_SELECT, type GlassModel } from '@/hooks/useGlassModels';
import type { GlassOutline } from '@/lib/sketch/outline';
import type { SketchGlass } from '@/lib/sketch/types';
import { supabase } from '@/lib/supabase';

// A bar's glassware (bar_glassware, supabase/migrations/20261007100000_glass_variants.sql):
// the glasses it pours into and which drawing each one is, on the bar's
// profile. A real glass (model_id) keeps its maker, series and designer on the
// model (20261103230000); they're filled in here, so a row reads the same
// either way. Row shapes are written by hand until types/ is regenerated.

export interface BarGlass {
  id: string;
  glass: SketchGlass;
  /** A lib/sketch/geometry.ts GLASS_VARIANTS key; null is the default drawing. */
  variant: string | null;
  name: string | null;
  maker: string | null;
  maker_profile_id: string | null;
  /** The maker's page, when the glass names one (20261014200000). */
  maker_page: { handle: string; display_name: string } | null;
  designer: string | null;
  series: string | null;
  shape_note: string | null;
  source_urls: string[];
  /** The real glass it is, when the venue picked one (20261026100000). */
  model_id: string | null;
  model: GlassModel | null;
  /** The glass of its type the bar's drinks are drawn in. */
  is_default: boolean;
  /** Bought (from supplier_id) or already ours; null is not said (20261110100000). */
  source: 'bought' | 'ours' | null;
  supplier_id: string | null;
  /** Null when not said, or this person can't see the venue's suppliers. */
  supplier_name: string | null;
  count: number | null;
  /** Its own shape, traced from the venue's photo (Draw my glass, 20261118500000), and the capacity they typed to size it. */
  outline: GlassOutline | null;
  capacity_ml: number | null;
  /** What its drinks fill it to (20261123400000); null reads from the capacity (lib/glassFill.ts washLine). */
  wash_line_ml: number | null;
  /** The photo it was traced from, private (the glass-photos bucket). */
  photo_path: string | null;
  /** The bar's name, for "Little Rye uses this". */
  bar_name: string;
}

/** A venue's glasses (through its profile), in its order. Pass null to skip. */
export function useBarGlassware(barId: string | null | undefined) {
  return useQuery({
    queryKey: ['bar-glassware', barId],
    enabled: !!barId,
    staleTime: 10 * 60_000,
    queryFn: () => fetchBarGlassware(barId!),
  });
}

export async function fetchBarGlassware(barId: string): Promise<BarGlass[]> {
  const { data, error } = await supabase
    .from('bar_glassware')
    .select(
      `id, glass, variant, name, maker, maker_profile_id, designer, series, shape_note, source_urls, is_default, source, supplier_id, count, outline, capacity_ml, wash_line_ml, photo_path, supplier:suppliers(name), model_id, model:glass_models!bar_glassware_model_id_fkey(${GLASS_MODEL_SELECT}), profiles:profiles!bar_glassware_profile_id_fkey!inner(bar_id, display_name), maker_page:profiles!bar_glassware_maker_profile_id_fkey(handle, display_name)`
    )
    .eq('profiles.bar_id', barId)
    .order('sort_order')
    .order('created_at');
  if (error) throw error;
  type Row = Omit<BarGlass, 'bar_name' | 'supplier_name'> & { profiles: { display_name: string } | null; supplier: { name: string } | null };
  return ((data ?? []) as Row[]).map(({ profiles, supplier, ...row }) => ({ ...withModel(row), supplier_name: supplier?.name ?? null, bar_name: profiles?.display_name ?? '' }));
}

/** A real glass's maker, series and designer, which live on its model. */
export function withModel<T extends Pick<BarGlass, 'model' | 'maker' | 'maker_profile_id' | 'maker_page' | 'series' | 'designer'>>(row: T): T {
  const m = row.model;
  if (!m) return row;
  return {
    ...row,
    maker: row.maker ?? m.maker?.display_name ?? null,
    maker_profile_id: row.maker_profile_id ?? m.maker_profile_id,
    maker_page: row.maker_page ?? m.maker ?? null,
    series: row.series ?? m.series,
    designer: row.designer ?? m.designer,
  };
}
