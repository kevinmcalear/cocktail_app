import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/ctx/AuthContext';
import type { BarGlass, BarGlassInput } from '@/hooks/useBarGlassware';
import { GLASS_MODEL_SELECT } from '@/hooks/useGlassModels';
import type { VenueIce, VenueIceChange } from '@/hooks/useVenueIce';
import type { SketchGlass } from '@/lib/sketch/types';
import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/db';

// My Bar's glassware and ice (home_glassware, home_ice:
// supabase/migrations/20261117100000_home_glassware_ice.sql): optional, the
// owner's own. Read in the venue's shapes (BarGlass, VenueIce) so Kit's list,
// page and sheets show them as they show a venue's.

const glassKey = ['home-glassware'] as const;
const iceKey = ['home-ice'] as const;

/** Your glasses at home, in the order you added them. */
export function useHomeGlassware() {
  const { session } = useAuth();
  return useQuery({
    queryKey: glassKey,
    enabled: !!session,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<BarGlass[]> => {
      const { data, error } = await supabase
        .from('home_glassware')
        .select(`id, glass, variant, name, model_id, source, count, is_default, outline, capacity_ml, photo_path, model:glass_models(${GLASS_MODEL_SELECT})`)
        .order('created_at');
      if (error) throw error;
      type Row = Pick<BarGlass, 'id' | 'variant' | 'name' | 'model_id' | 'source' | 'count' | 'is_default' | 'model' | 'outline' | 'capacity_ml' | 'photo_path'> & { glass: string };
      return ((data ?? []) as unknown as Row[]).map((r) => ({
        ...r,
        glass: r.glass as SketchGlass,
        // A real glass's maker and series are on its model; nothing else is kept at home.
        maker: r.model?.maker?.display_name ?? null,
        maker_profile_id: r.model?.maker_profile_id ?? null,
        maker_page: r.model?.maker ?? null,
        designer: r.model?.designer ?? null,
        series: r.model?.series ?? null,
        shape_note: null,
        source_urls: [],
        supplier_id: null,
        supplier_name: null,
        bar_name: '',
      }));
    },
  });
}

/** Add one of your glasses, or change one. The first of its type is the one its drinks are drawn in. */
export function useSaveHomeGlass() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, glass, variant, name, model_id, source, count, is_default, outline, capacity_ml, photo_path }: BarGlassInput) => {
      // Draw my glass's three stay as they are when left out (undefined isn't sent).
      const row = { glass, variant, name, model_id: model_id ?? null, source: source ?? null, count: count ?? null, is_default, outline: outline as Json | null | undefined, capacity_ml, photo_path };
      if (is_default) {
        let others = supabase.from('home_glassware').update({ is_default: false }).eq('glass', glass).eq('is_default', true);
        if (id) others = others.neq('id', id);
        const { error } = await others;
        if (error) throw error;
      }
      const { data, error } = id ? await supabase.from('home_glassware').update(row).eq('id', id).select('id').single() : await supabase.from('home_glassware').insert(row).select('id').single();
      if (error) throw error;
      return data.id;
    },
    onSettled: () => client.invalidateQueries({ queryKey: glassKey }),
  });
}

export function useRemoveHomeGlass() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('home_glassware').delete().eq('id', id);
      if (error) throw error;
    },
    onSettled: () => client.invalidateQueries({ queryKey: glassKey }),
  });
}

/** Your ice at home, in the order you added it. */
export function useHomeIce() {
  const { session } = useAuth();
  return useQuery({
    queryKey: iceKey,
    enabled: !!session,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<VenueIce[]> => {
      const { data, error } = await supabase
        .from('home_ice')
        .select('id, name, shape, draw_as, size_mm, length_mm, clear, stamped, frozen_inside, source, machine, note')
        .order('created_at');
      if (error) throw error;
      return (data ?? []).map((r) => ({ ...r, shape: r.shape as VenueIce['shape'], supplier_id: null, supplier_name: null }));
    },
  });
}

/** Add some of your ice, or change it; the id it's saved under. */
export function useSaveHomeIce() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, supplier_id: _none, ...ice }: VenueIceChange): Promise<string> => {
      const { data, error } = id
        ? await supabase.from('home_ice').update(ice).eq('id', id).select('id').single()
        : await supabase.from('home_ice').insert(ice).select('id').single();
      if (error) throw error;
      return data.id;
    },
    onSettled: () => client.invalidateQueries({ queryKey: iceKey }),
  });
}

export function useRemoveHomeIce() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('home_ice').delete().eq('id', id);
      if (error) throw error;
    },
    onSettled: () => client.invalidateQueries({ queryKey: iceKey }),
  });
}
