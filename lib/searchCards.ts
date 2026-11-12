/**
 * A row of app_item_presentation as a search card (types/search.ts): from a
 * list read (hooks/useSearchCatalog.ts) or from a venue's spec book
 * (lib/mineSearch.ts). One mapping for both, so a drink is the same card
 * wherever it was read from. Pure.
 */
import { heroPicture, type ItemImageLink } from '@/lib/itemImages';
import type { SearchItem } from '@/types/search';

/** What a card reads from a row. */
export interface CardRow {
  id: string | null;
  name: string | null;
  item_type?: string | null;
  description?: string | null;
  service_style?: string | null;
  price?: string | null;
  glassware_id?: string | null;
  ice_id?: string | null;
  recipes?: unknown;
  item_images?: ItemImageLink[] | null;
  item_categories?: { category_id: string }[] | null;
  item_methods?: { method_item_id?: string | null }[] | null;
}

/** A search card's picture: photos before sketches, tagged when it's a sketch. */
export function searchImage(links: ItemImageLink[] | null | undefined): Pick<SearchItem, 'image' | 'imageIsSketch'> {
  const hero = heroPicture(links);
  return hero ? { image: { uri: hero.url }, imageIsSketch: hero.isSketch } : {};
}

/** A drink as a search card. */
export function toCocktailSearchItem(c: CardRow): SearchItem {
  return {
    id: c.id!,
    name: c.name!,
    description: c.description,
    category: 'Cocktail',
    serviceStyle: c.service_style ?? null,
    recipes: c.recipes as SearchItem['recipes'],
    item_images: c.item_images ?? undefined,
    ...searchImage(c.item_images),
    item_categories: c.item_categories ?? undefined,
    method_id: c.item_methods?.[0]?.method_item_id ?? null,
    glassware_id: c.glassware_id,
    ice_id: c.ice_id,
  };
}

/** A beer or a wine as a search card: its id carries its kind ("beer-…"), as its routes read it. */
export function toPourSearchItem(category: 'Beer' | 'Wine', row: CardRow): SearchItem {
  return {
    id: `${category.toLowerCase()}-${row.id}`,
    name: row.name!,
    description: row.description,
    category,
    price: row.price,
    glassware_id: row.glassware_id ?? null,
    item_categories: row.item_categories ?? undefined,
    ...searchImage(row.item_images),
  };
}

/** An ingredient as a search card. `images`: a batch's, with its drink's photos (hooks/useSearchCatalog.ts). */
export function toIngredientSearchItem(row: CardRow, images: ItemImageLink[] | null | undefined = row.item_images): SearchItem {
  return {
    id: row.id!,
    name: row.name!,
    description: row.description,
    category: 'Ingredient',
    item_categories: row.item_categories ?? undefined,
    ...searchImage(images),
  };
}

/** Any row by its kind; null for a kind search doesn't show (a glass, a method, an ice). */
export function toSearchItem(row: CardRow): SearchItem | null {
  if (!row.id || !row.name) return null;
  if (row.item_type === 'cocktail') return toCocktailSearchItem(row);
  if (row.item_type === 'beer') return toPourSearchItem('Beer', row);
  if (row.item_type === 'wine') return toPourSearchItem('Wine', row);
  if (row.item_type === 'ingredient') return toIngredientSearchItem(row);
  return null;
}
