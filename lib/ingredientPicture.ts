import type { Enum } from '@/types/db';

import type { ItemPicture } from './itemImages';

/** items.picture: the house drawing (the default), the bar's own photo, or none. */
export type IngredientPicture = Enum<'item_picture'>;

/** What an ingredient shows, from app_item_presentation's picture and picture_url. */
export type ShownIngredientPicture = { kind: 'drawing' } | { kind: 'photo'; url: string } | { kind: 'none' };

/**
 * Read from the view. Your photo without a photo (it was removed) falls back
 * to the drawing; an old cached row with no picture yet is drawn.
 */
export function shownIngredientPicture(picture: IngredientPicture | null | undefined, url: string | null | undefined): ShownIngredientPicture {
  if (picture === 'photo' && url) return { kind: 'photo', url };
  if (picture === 'none') return { kind: 'none' };
  return { kind: 'drawing' };
}

export const PICTURE_LABEL: Record<IngredientPicture, string> = { drawing: 'Drawing', photo: 'Your photo', none: 'None' };

/**
 * The top of its page. Null: None, so the page starts with the name. A photo
 * leads alone; with Drawing, a batch keeps the photos of the drink it makes
 * (`batch`), and anything else is drawn ([]).
 */
export function ingredientHeroPictures<P>(shown: ShownIngredientPicture, batch: P[]): (P | ItemPicture)[] | null {
  if (shown.kind === 'none') return null;
  if (shown.kind === 'photo') return [{ url: shown.url, isSketch: false, isOutdated: false, credit: null, sourceUrl: null }];
  return batch;
}

/** Only what a bar or a person owns gets the choice; shared catalogue items stay drawn (guard_item_picture). */
export function canChoosePicture(item: { bar_id?: string | null; created_by?: string | null; item_type?: string | null } | null | undefined): boolean {
  return !!item && (item.item_type ?? 'ingredient') === 'ingredient' && (!!item.bar_id || !!item.created_by);
}
