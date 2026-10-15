import { useQuery } from '@tanstack/react-query';

import { glassSizeLabel } from '@/lib/glass';
import type { SketchGlass } from '@/lib/sketch/types';
import { supabase } from '@/lib/supabase';

// Real glasses you can buy (glass_models, supabase/migrations/20261023100000_glass_models.sql):
// a maker's model and size, a kind of a catalog shape, drawn as one of our
// glass variants. Row shapes are written by hand until types/ is regenerated.

export interface GlassModel {
  id: string;
  maker_profile_id: string;
  maker: { handle: string; display_name: string } | null;
  /** The shared glassware item it is a kind of ("Coupe"), when the load found one. */
  shape_item_id: string | null;
  glass: SketchGlass;
  /** A lib/sketch/geometry.ts GLASS_VARIANTS key; null is the default drawing. */
  variant: string | null;
  name: string;
  series: string | null;
  designer: string | null;
  model_code: string | null;
  capacity_ml: number | null;
  height_mm: number | null;
  rim_mm: number | null;
  material: string | null;
  product_url: string | null;
}

export const GLASS_MODEL_SELECT =
  'id, maker_profile_id, shape_item_id, glass, variant, name, series, designer, model_code, capacity_ml, height_mm, rim_mm, material, product_url, maker:profiles!glass_models_maker_profile_id_fkey(handle, display_name)';

/** How many glasses a search returns at most. */
export const GLASS_SEARCH_LIMIT = 40;

/** "190 ml": a model's size to the brim, or null. */
export const glassModelSize = (m: Pick<GlassModel, 'capacity_ml'>) => glassSizeLabel({ capacity_ml: m.capacity_ml, iced_capacity_ml: null });

/** "Lead-free crystal", or null. */
export const glassModelMaterial = (m: Pick<GlassModel, 'material'>) => (m.material ? m.material[0].toUpperCase() + m.material.slice(1) : null);

/** "190 ml · 165 mm tall · Crystal": the facts a row shows under its name. */
export function glassModelFacts(m: Pick<GlassModel, 'capacity_ml' | 'height_mm' | 'material'>): string {
  return [glassModelSize(m), m.height_mm ? `${Math.round(m.height_mm)} mm tall` : null, glassModelMaterial(m)].filter(Boolean).join(' · ');
}

/**
 * Makers' glasses matching what's typed (every word, anywhere in the maker,
 * name, series, designer, item code or size), of one type when given. An
 * empty search lists the type's glasses, maker by maker.
 */
export function useGlassModelSearch(term: string, glass: SketchGlass | null, { enabled = true, limit = GLASS_SEARCH_LIMIT } = {}) {
  const q = term.trim();
  return useQuery({
    queryKey: ['glass-models', q, glass, limit],
    enabled: enabled && (q.length >= 2 || !!glass),
    staleTime: 60 * 60_000,
    meta: { public: true },
    queryFn: async (): Promise<GlassModel[]> => {
      const { data, error } = await supabase
        .rpc('search_glass_models', {
          p_query: q,
          p_glass: glass,
          p_limit: limit,
        })
        .select(GLASS_MODEL_SELECT);
      if (error) throw error;
      return (data ?? []) as unknown as GlassModel[];
    },
  });
}

/**
 * The real glass a drink is served in (items.glass_model_id), or null.
 * ponytail: its own small read; move it into app_item_presentation the next time that view is redefined.
 */
export function useDrinkGlassModel(itemId: string | null | undefined) {
  return useQuery({
    queryKey: ['drink-glass-model', itemId],
    enabled: !!itemId,
    meta: { public: true },
    queryFn: async (): Promise<GlassModel | null> => {
      const { data, error } = await supabase
        .from('items')
        .select(`glass_model:glass_models!items_glass_model_id_fkey(${GLASS_MODEL_SELECT})`)
        .eq('id', itemId!)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as { glass_model: GlassModel | null } | null)?.glass_model ?? null;
    },
  });
}
