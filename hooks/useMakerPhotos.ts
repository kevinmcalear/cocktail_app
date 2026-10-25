import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { uploadDrinkPhoto } from '@/components/drink/drinkImages';
import { useUserId } from '@/ctx/AuthContext';
import { useBars } from '@/hooks/useBars';
import { forgetIngredientChain } from '@/hooks/useIngredientChain';
import { supabase } from '@/lib/supabase';

/** A team's photo on one of its bottles; `checked` false while it waits for a moderator. */
export interface MakerBottlePhoto {
  url: string;
  checked: boolean;
}

/** Whether you're on the team that runs this maker page (Drink Creator and up, as set_maker_bottle_picture checks). */
export function useOnMakerTeam(barId: string | null | undefined): boolean {
  const { data: bars } = useBars();
  return !!barId && !!bars?.some((b) => b.bar_id === barId && b.role_level >= 35);
}

/** The team's photos on its bottles, waiting ones included, by bottle id. Empty for anyone off the team. */
export function useMakerBottlePhotos(profileId: string | null | undefined, enabled = true) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['maker-bottle-photos', profileId, userId],
    enabled: !!profileId && !!userId && enabled,
    queryFn: async (): Promise<Record<string, MakerBottlePhoto>> => {
      const { data, error } = await supabase.rpc('maker_bottle_photos', { p_profile_id: profileId! });
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((r) => [r.item_id, { url: r.url, checked: r.checked }]));
    },
  });
}

/**
 * How many drinks use each bottle, from the spec lines you can read.
 * ponytail: one capped read (1,000 lines); a brand with more needs a counting RPC.
 */
export function useBottleUses(ids: readonly string[]) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['bottle-uses', [...ids].sort().join(','), userId],
    enabled: !!userId && ids.length > 0,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase.from('recipes').select('ingredient_item_id, recipe_item_id').in('ingredient_item_id', [...ids]).limit(1000);
      if (error) throw error;
      const drinks = new Map<string, Set<string>>();
      for (const r of data ?? []) {
        if (!r.ingredient_item_id || !r.recipe_item_id) continue;
        drinks.set(r.ingredient_item_id, (drinks.get(r.ingredient_item_id) ?? new Set()).add(r.recipe_item_id));
      }
      return Object.fromEntries([...drinks].map(([id, set]) => [id, set.size]));
    },
  });
}

/**
 * Sets one of the team's bottles to its drawing or its photo. A new photo (a
 * local file) uploads to ingredients/<id>/ the way an ingredient's does; the
 * function checks it's the team's bottle and that photo.
 */
export function useSetMakerBottlePicture(profileId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, picture, photo }: { itemId: string; picture: 'drawing' | 'photo'; photo?: string | null }) => {
      const image = photo ? await uploadDrinkPhoto(photo, `ingredients/${itemId}`).catch(() => null) : null;
      if (photo && !image) throw new Error("Couldn't upload the photo. Check your connection and try again.");
      const { error } = await supabase.rpc('set_maker_bottle_picture', { p_item_id: itemId, p_picture: picture, ...(image ? { p_image_id: image.id } : {}) });
      if (error) throw new Error(error.code === '42501' ? "Only the maker's own team can change this bottle's picture." : "Couldn't save its picture.");
    },
    onSuccess: async (_, { itemId }) => {
      await Promise.all([qc.invalidateQueries({ queryKey: ['maker-bottle-photos', profileId] }), forgetIngredientChain(qc, itemId)]);
    },
  });
}

export interface WaitingMakerPhoto {
  item_id: string;
  name: string;
  maker_id: string;
  maker_name: string;
  maker_handle: string;
  url: string;
  added_at: string;
}

/** Moderators: bottle photos waiting for a check, oldest first. Empty for everyone else. */
export function useMakerPhotosWaiting() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['maker-photos-waiting', userId],
    enabled: !!userId,
    // A moderation queue: always refetch rather than trust the persisted cache.
    staleTime: 0,
    queryFn: async (): Promise<WaitingMakerPhoto[]> => {
      const { data, error } = await supabase.rpc('maker_photos_waiting');
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Moderators keep a waiting photo (it shows) or take it off (the bottle is drawn again). */
export function useCheckMakerPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, keep }: { itemId: string; keep: boolean }) => {
      const { error } = await supabase.rpc('check_maker_photo', { p_item_id: itemId, p_keep: keep });
      if (error) throw error;
    },
    onSuccess: async (_, { itemId }) => {
      await Promise.all([qc.invalidateQueries({ queryKey: ['maker-photos-waiting'] }), qc.invalidateQueries({ queryKey: ['maker-bottle-photos'] }), forgetIngredientChain(qc, itemId)]);
    },
  });
}
