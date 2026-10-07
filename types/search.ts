import type { ItemImageLink } from '@/lib/itemImages';

/** A card in search, the Library and the menu pickers. */
export interface SearchItem {
  id: string;
  name: string;
  description?: string | null;
  category?: 'Cocktail' | 'Beer' | 'Wine' | 'Ingredient' | 'Category' | 'Menu';
  isDraft?: boolean;
  /** How far a draft has got, for its badge. */
  draftProgress?: { percentage: number; color: string; label: string; badgeBg: string; badgeText: string };
  price?: string | null;
  recipes?: {
    display_ingredient_id?: string | null;
    ingredient_item_id?: string;
    ingredient?: {
      name: string;
      item_categories?: {
        category_id: string;
      }[];
    } | null;
  }[];
  item_images?: ItemImageLink[];
  /** Set with `image` when that picture is a generated sketch. */
  imageIsSketch?: boolean;
  item_categories?: {
    category_id: string;
  }[];
  /** The picture, as an image source. */
  image?: { uri?: string } | null;
  method_id?: string | null;
  glassware_id?: string | null;
  family_id?: string | null;
  ice_id?: string | null;
  /** A public drink (not in the library): the bar or bartender it's credited to. */
  fromBar?: string;
  /** A bar's drink on a menu: "on now", or "Past · Mar 2024 to Jan 2025". */
  menuRun?: string;
  /** Sorts a bar's drinks: on a menu now first, past menus last. */
  menuOrder?: number;
}
