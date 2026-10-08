import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { uploadDrinkPhoto } from '@/components/drink/drinkImages';
import { useAuth } from '@/ctx/AuthContext';
import { supabase } from '@/lib/supabase';

/** Someone's photo of a drink, as get_drink_photos() returns it. */
export interface DrinkPhoto {
  id: string;
  imageUrl: string;
  createdAt: string;
  isMine: boolean;
  /** Null when the poster has no profile the viewer may read. */
  poster: { handle: string; name: string } | null;
  /** Their 0 to 10 score, when they chose to show it with the photo. */
  score: number | null;
}

interface Row {
  id: string;
  image_url: string;
  created_at: string;
  is_mine: boolean;
  poster_handle: string | null;
  poster_name: string | null;
  score: number | string | null;
}

const key = (itemId: string, userId: string | null) => ['drink-photos', itemId, userId];

/**
 * People's photos of a drink, newest first. The server leaves out hidden
 * photos and anyone on either side of a block. Empty when signed out.
 */
export function useDrinkPhotos(itemId: string | null | undefined) {
  const userId = useAuth().user?.id ?? null;
  return useQuery({
    queryKey: key(itemId ?? '', userId),
    enabled: !!itemId && !!userId,
    queryFn: async (): Promise<DrinkPhoto[]> => {
      const { data, error } = await supabase.rpc('get_drink_photos', { p_item_id: itemId!, p_limit: 30 });
      if (error) throw error;
      return ((data ?? []) as Row[]).map((r) => ({
        id: r.id,
        imageUrl: r.image_url,
        createdAt: r.created_at,
        isMine: r.is_mine,
        poster: r.poster_handle && r.poster_name ? { handle: r.poster_handle, name: r.poster_name } : null,
        score: r.score == null ? null : Number(r.score),
      }));
    },
  });
}

/**
 * Posts a photo of a drink as the signed-in person: uploads it to the drinks
 * bucket, then links it. `rankEntryId` shows their score with it.
 */
export function useAddDrinkPhoto(itemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ uri, rankEntryId }: { uri: string; rankEntryId: string | null }) => {
      const image = await uploadDrinkPhoto(uri, `cocktails/${itemId}/people`).catch(() => null);
      if (!image) throw new Error("Couldn't upload the photo. Check your connection and try again.");
      const { error } = await supabase.from('drink_photos').insert({ item_id: itemId, image_id: image.id, rank_entry_id: rankEntryId });
      if (error) {
        throw new Error(
          error.code === '42501' ? "Couldn't post it. You can add up to 20 photos a day, once your age is confirmed." : "Couldn't save the photo."
        );
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['drink-photos', itemId] }),
  });
}

/** Deletes one of my photos. */
export function useDeleteDrinkPhoto(itemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (photoId: string) => {
      const { error } = await supabase.from('drink_photos').delete().eq('id', photoId);
      if (error) throw new Error("Couldn't delete the photo. Try again.");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['drink-photos', itemId] }),
  });
}
