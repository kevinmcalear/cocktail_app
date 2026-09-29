import { useMutation, useQueryClient } from '@tanstack/react-query';

import { uploadDrinkPhoto } from '@/components/drink/drinkImages';
import { supabase } from '@/lib/supabase';
import type { ServiceAngle } from '@/lib/servicePhotos';

export interface AddServicePhoto {
  angle: ServiceAngle;
  /** A local file, or a blob: URL from a web drop. */
  uri: string;
  /** The angle's old photo links, removed once the new one is saved. */
  replaces: string[];
}

/**
 * Adds a service photo (side, top, garnish or hand-off) to a drink: uploads it
 * to the drinks bucket and links it with its angle. The server stamps it
 * against the spec on its next image job. Errors are toasted by the global
 * mutation handler, so each one says what went wrong.
 */
export function useAddServicePhoto(itemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ angle, uri, replaces }: AddServicePhoto) => {
      const image = await uploadDrinkPhoto(uri, `cocktails/${itemId}`).catch(() => null);
      if (!image) throw new Error("Couldn't upload the photo. Check your connection and try again.");

      const { error } = await supabase.from('item_images').insert({ item_id: itemId, image_id: image.id, angle, sort_order: 0 });
      if (error) {
        throw new Error(error.code === '42501' ? "You can't add photos to this drink." : "Couldn't save the photo.");
      }
      if (replaces.length) {
        // The new photo is saved; an old one left behind is only a spare, so this can't lose anything.
        await supabase.from('item_images').delete().in('id', replaces);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['cocktail', itemId] }),
  });
}
