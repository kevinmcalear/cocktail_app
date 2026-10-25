import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { useCapabilities } from '@/hooks/useCapabilities';
import { removeGlassPhoto } from '@/hooks/useGlassDrawing';
import { GLASS_MODEL_SELECT, type GlassModel } from '@/hooks/useGlassModels';
import type { GlassOutline } from '@/lib/sketch/outline';
import type { SketchGlass } from '@/lib/sketch/types';
import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/db';
import { heldGlassPlan } from '@/lib/whatNext';
import { useVenueSetup, type HeldGlass } from '@/store/useVenueSetup';

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

async function fetchBarGlassware(barId: string): Promise<BarGlass[]> {
  const { data, error } = await supabase
    .from('bar_glassware')
    .select(
      `id, glass, variant, name, maker, maker_profile_id, designer, series, shape_note, source_urls, is_default, source, supplier_id, count, outline, capacity_ml, photo_path, supplier:suppliers(name), model_id, model:glass_models!bar_glassware_model_id_fkey(${GLASS_MODEL_SELECT}), profiles:profiles!bar_glassware_profile_id_fkey!inner(bar_id, display_name), maker_page:profiles!bar_glassware_maker_profile_id_fkey(handle, display_name)`
    )
    .eq('profiles.bar_id', barId)
    .order('sort_order')
    .order('created_at');
  if (error) throw error;
  type Row = Omit<BarGlass, 'bar_name' | 'supplier_name'> & { profiles: { display_name: string } | null; supplier: { name: string } | null };
  return ((data ?? []) as unknown as Row[]).map(({ profiles, supplier, ...row }) => ({ ...withModel(row), supplier_name: supplier?.name ?? null, bar_name: profiles?.display_name ?? '' }));
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
  /** Left out, they stay as they are. */
  source?: 'bought' | 'ours' | null;
  supplier_id?: string | null;
  count?: number | null;
  /** Draw my glass: its traced shape, the capacity typed (null: the height was), the photo. Left out, they stay. */
  outline?: GlassOutline | null;
  capacity_ml?: number | null;
  photo_path?: string | null;
}

/**
 * After a venue's glasses change: the list, and the drinks drawn in them. The
 * database redraws the venue's drinks on any change (refresh_sketch_variant),
 * but phones hold drawings for ten minutes, so the glass just picked wouldn't
 * show until then.
 */
function invalidateGlassware(client: QueryClient, barId: string | null | undefined) {
  client.invalidateQueries({ queryKey: ['bar-glassware', barId] });
  client.invalidateQueries({ queryKey: ['maker-glass-bars'] });
  client.invalidateQueries({ queryKey: ['item-sketch'] });
  client.invalidateQueries({ queryKey: ['drinks-drawn-in', barId] });
}

/**
 * Add or change one of the venue's glasses. Only one glass of a type is the
 * main one (a unique index), so marking this one first unmarks the others.
 * The database checks the venue's Prep permission and the maker page.
 */
export function useSaveBarGlass(barId: string | null | undefined, profileId: string | null | undefined) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: BarGlassInput) => {
      // The outline is plain JSON; its interface just doesn't say so.
      const row = { ...input, outline: input.outline as Json | null | undefined };
      if (row.is_default) {
        let others = supabase.from('bar_glassware').update({ is_default: false }).eq('profile_id', profileId!).eq('glass', row.glass).eq('is_default', true);
        if (id) others = others.neq('id', id);
        const { error } = await others;
        if (error) throw error;
      }
      const { data, error } = id
        ? await supabase.from('bar_glassware').update(row).eq('id', id).select('id').single()
        : await supabase.from('bar_glassware').insert({ ...row, profile_id: profileId! }).select('id').single();
      if (error) throw error;
      return data.id;
    },
    onSettled: () => invalidateGlassware(client, barId),
  });
}

/** Take a glass off the venue's list. */
export function useDeleteBarGlass(barId: string | null | undefined) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from('bar_glassware').delete().eq('id', id).select('photo_path');
      if (error) throw error;
      // A glass drawn from a photo takes its photo with it.
      await removeGlassPhoto(data?.[0]?.photo_path);
    },
    onSettled: () => invalidateGlassware(client, barId),
  });
}

const NONE: HeldGlass[] = [];

/** Glasses What next holds on this device for a venue whose page isn't checked yet (store/useVenueSetup). */
export function useHeldGlasses(barId: string | null | undefined): HeldGlass[] {
  return useVenueSetup((s) => (barId ? s.glasses[barId] : undefined)) ?? NONE;
}

// Venues whose held glasses are being saved now: What next and Venue settings can both be mounted.
const flushing = new Set<string>();

/**
 * Glasses picked before the venue's page was checked go onto it once it's
 * linked and the venue can write to it (Prep): each saved as Glassware saves
 * one, then let go from the device. Once per screen, where What next and
 * Venue settings open; a save that fails keeps the rest for next time.
 */
export function useFlushHeldGlasses(barId: string | null | undefined) {
  const client = useQueryClient();
  const waiting = useHeldGlasses(barId).length > 0;
  const caps = useCapabilities(waiting ? barId : null).data;
  const pageId = useBarPageId(waiting ? barId : null).data ?? null;
  const ready = waiting && !!pageId && !!caps?.includes('prep');
  const save = useSaveBarGlass(barId, pageId);
  const tried = useRef(false);
  useEffect(() => {
    if (!ready || !barId || tried.current || flushing.has(barId)) return;
    tried.current = true;
    flushing.add(barId);
    void (async () => {
      try {
        // What's on the page now, not a list cached while it was unchecked.
        const onPage = await client.fetchQuery({ queryKey: ['bar-glassware', barId], queryFn: () => fetchBarGlassware(barId), staleTime: 0 });
        const { glasses, dropGlass } = useVenueSetup.getState();
        const plan = heldGlassPlan(glasses[barId] ?? [], onPage);
        for (const key of plan.skip) dropGlass(barId, key);
        for (const { key, ...row } of plan.save) {
          // A real glass's maker stays on its model: the held copy is only for showing it meanwhile.
          await save.mutateAsync(row.model_id ? { ...row, maker: null, maker_profile_id: null, series: null, designer: null } : row);
          dropGlass(barId, key);
        }
      } catch (e) {
        console.warn('Held glasses wait for next time', e);
      } finally {
        flushing.delete(barId);
      }
    })();
  }, [ready, barId, client, save]);
}
