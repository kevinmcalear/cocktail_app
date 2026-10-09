import type { ItemImageLink } from '@/lib/itemImages';

/** What a tapped list row already knows about a drink: enough to paint its page's hero and name. */
export interface DrinkSeed {
  id: string;
  name: string;
  /** The row's picture, when it has one URL rather than the links. */
  imageUrl?: string | null;
  item_images?: ItemImageLink[] | null;
}

/** A drink page's placeholder: the row's name and pictures, in the shape the page reads. */
export interface SeedItem {
  id: string;
  name: string;
  item_images: ItemImageLink[];
}

// The last few rows pressed, in memory only: a placeholder is never cached
// or saved, so nothing reads it as the real drink.
const seeds = new Map<string, SeedItem>();
const KEEP = 50;

/** Remembers a pressed row, for its page's first paint. */
export function seedDrink(seed: DrinkSeed): void {
  const images = seed.item_images?.length ? seed.item_images : seed.imageUrl ? [{ angle: 'hero' as const, images: { url: seed.imageUrl } }] : [];
  seeds.delete(seed.id);
  seeds.set(seed.id, { id: seed.id, name: seed.name, item_images: images });
  if (seeds.size > KEEP) seeds.delete(seeds.keys().next().value!);
}

/** The pressed row for this drink, if there was one. */
export function drinkSeed(id: string | null | undefined): SeedItem | undefined {
  return id ? seeds.get(id) : undefined;
}
