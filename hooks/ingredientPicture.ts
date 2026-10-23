import type { QueryClient } from '@tanstack/react-query';

import { uploadDrinkPhoto } from '@/components/drink/drinkImages';
import { forgetIngredientChain } from '@/hooks/useIngredientChain';
import type { IngredientPicture } from '@/lib/ingredientPicture';
import { supabase } from '@/lib/supabase';

/**
 * Saves an ingredient's picture (the edit page's "Its picture"): a new photo
 * (a local file) goes up the way a drink's does, to the drinks bucket under
 * ingredients/<id>/, then set_item_picture makes the choice in one step. Its
 * row checks decide who may: whoever can edit the ingredient.
 */
export async function saveIngredientPicture(queryClient: QueryClient, itemId: string, picture: IngredientPicture, photo: string | null) {
  const fresh = picture === 'photo' && !!photo && !/^https?:/.test(photo);
  const image = fresh ? await uploadDrinkPhoto(photo, `ingredients/${itemId}`).catch(() => null) : null;
  if (fresh && !image) throw new Error("Couldn't upload the photo. Check your connection and try again.");
  const { error } = await supabase.rpc('set_item_picture', { p_item_id: itemId, p_picture: picture, ...(image ? { p_image_id: image.id } : {}) });
  if (error) throw new Error(error.code === '42501' ? "You can't change this ingredient's picture." : "Couldn't save its picture.");
  await forgetIngredientChain(queryClient, itemId);
}
