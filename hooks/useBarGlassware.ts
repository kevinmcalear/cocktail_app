import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { GLASS_MODEL_SELECT, type GlassModel } from '@/hooks/useGlassModels';
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
          `id, glass, variant, name, maker, maker_profile_id, designer, series, shape_note, source_urls, is_default, model_id, model:glass_models!bar_glassware_model_id_fkey(${GLASS_MODEL_SELECT}), profiles:profiles!bar_glassware_profile_id_fkey!inner(bar_id, display_name), maker_page:profiles!bar_glassware_maker_profile_id_fkey(handle, display_name)`
        )
        .eq('profiles.bar_id', barId!)
        .order('sort_order')
        .order('created_at');
      if (error) throw error;
      type Row = Omit<BarGlass, 'bar_name'> & { profiles: { display_name: string } | null };
      return ((data ?? []) as unknown as Row[]).map(({ profiles, ...row }) => ({ ...withModel(row), bar_name: profiles?.display_name ?? '' }));
    },
  });
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

/** The bar's own glass drawings, as the sketch's barVariants. */
export const barVariants = (rows: readonly BarGlass[] | undefined): string[] => (rows ?? []).filter((g) => g.is_default && g.variant).map((g) => g.variant as string);

/** The bar's default glass of a type, if it has one. */
export const barGlassFor = (rows: readonly BarGlass[] | undefined, glass: SketchGlass) => rows?.find((r) => r.glass === glass && r.is_default) ?? null;

/** The venue's public page (kind bar): glassware hangs off it. Null when the venue has none yet. */
export function useBarPageId(barId: string | null | undefined) {
  return useQuery({
    queryKey: ['bar-page-id', barId],
    enabled: !!barId,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.from('profiles').select('id').eq('bar_id', barId!).eq('kind', 'bar').maybeSingle();
      if (error) throw error;
      return (data?.id as string | undefined) ?? null;
    },
  });
}

export interface BarGlassInput {
  /** Set to change a glass; absent to add one. */
  id?: string;
  glass: SketchGlass;
  variant: string | null;
  name: string | null;
  maker: string | null;
  maker_profile_id: string | null;
  designer: string | null;
  series: string | null;
  shape_note: string | null;
  /** The real glass, when one was picked; picking fills what the row leaves empty. */
  model_id?: string | null;
  is_default: boolean;
}

/**
 * Add or change one of the venue's glasses. Only one glass of a type is the
 * main one (a unique index), so marking this one first unmarks the others.
 * The database checks the venue's Prep permission and the maker page.
 */
export function useSaveBarGlass(barId: string | null | undefined, profileId: string | null | undefined) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...row }: BarGlassInput) => {
      if (row.is_default) {
        let others = supabase.from('bar_glassware').update({ is_default: false }).eq('profile_id', profileId!).eq('glass', row.glass).eq('is_default', true);
        if (id) others = others.neq('id', id);
        const { error } = await others;
        if (error) throw error;
      }
      const { error } = id
        ? await supabase.from('bar_glassware').update(row).eq('id', id)
        : await supabase.from('bar_glassware').insert({ ...row, profile_id: profileId! });
      if (error) throw error;
    },
    onSettled: () => {
      client.invalidateQueries({ queryKey: ['bar-glassware', barId] });
      client.invalidateQueries({ queryKey: ['maker-glass-bars'] });
    },
  });
}

/** Take a glass off the venue's list. */
export function useDeleteBarGlass(barId: string | null | undefined) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bar_glassware').delete().eq('id', id);
      if (error) throw error;
    },
    onSettled: () => {
      client.invalidateQueries({ queryKey: ['bar-glassware', barId] });
      client.invalidateQueries({ queryKey: ['maker-glass-bars'] });
    },
  });
}
