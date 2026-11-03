import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { useCapabilities } from '@/hooks/useCapabilities';
import { removeGlassPhoto } from '@/hooks/glassPhotoBucket';
import { fetchBarGlassware, type BarGlass } from '@/hooks/useBarGlassList';
import type { GlassOutline } from '@/lib/sketch/outline';
import type { SketchGlass } from '@/lib/sketch/types';
import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/db';
import { heldGlassPlan } from '@/lib/whatNext';
import { useVenueSetup, type HeldGlass } from '@/store/useVenueSetup';

// Reading the list lives in useBarGlassList: every drawing inside a bar reads it (DrawingBar), so it stays apart from the writes here.
export { fetchBarGlassware, useBarGlassware, withModel, type BarGlass } from '@/hooks/useBarGlassList';

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
  /** The wash line; left out, it stays. */
  wash_line_ml?: number | null;
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

/** What a venue glass's drinks fill it to (Fit it to the glass); null goes back to reading it from the capacity. */
export function useSetWashLine(barId: string | null | undefined) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ml }: { id: string; ml: number | null }) => {
      const { error } = await supabase.from('bar_glassware').update({ wash_line_ml: ml }).eq('id', id).select('id').single();
      if (error) throw error;
    },
    onSettled: () => client.invalidateQueries({ queryKey: ['bar-glassware', barId] }),
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
