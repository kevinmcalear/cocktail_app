import type { PublishedDrinkPage } from '@/hooks/usePublished';
import type { SpecLock } from '@/hooks/useSpecLock';
import type { DatabaseItem } from '@/types/types';

/**
 * A bar's published drink as the in-app drink page reads it, for someone
 * signed in from outside the bar (Kevin, 24 Oct: p02). The bar's own row stays
 * closed to them, so the page is built from what the public page shows: the
 * published row, and the spec when the bar shares it. A spec the bar keeps
 * back comes with the lock: why, the ingredient names and the bar's page
 * (board ppl-drink-menu-level).
 */
export function visitorDrink(page: PublishedDrinkPage): { item: DatabaseItem; lock: SpecLock | null } {
  const { drink, bar } = page;
  // ponytail: the published row has no method, notes or serve size; the page leaves those out until published_items carries them.
  const item = {
    id: drink.id,
    name: drink.name,
    item_type: drink.itemType,
    description: drink.description,
    bar_id: drink.barId,
    glassware_id: drink.glasswareId,
    ice_id: drink.iceId,
    family_id: drink.familyId,
    origin: drink.origin,
    abv: drink.abv,
    creator_profile_id: drink.creatorProfileId,
    origin_bar_profile_id: drink.originBarProfileId,
    notes: null,
    item_images: drink.imageUrl ? [{ angle: 'hero', is_generated: drink.imageIsGenerated, images: { url: drink.imageUrl } }] : [],
    recipes: page.recipes,
  } as DatabaseItem;
  const lock: SpecLock | null =
    drink.publishMode === 'spec' || !bar
      ? null
      : { bar: { id: drink.barId ?? drink.originBarProfileId ?? '', handle: bar.handle, name: bar.name, isClaimed: !!drink.barId, visibility: null }, names: page.names };
  return { item, lock };
}
