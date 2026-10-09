import type { SectionDrinkType } from '@/lib/sectionAllowedTypes';

/** Where a menu is in its life, worked out from its dates (lib/menus.ts). */
export type MenuStatus = 'draft' | 'upcoming' | 'on' | 'previous';

/** One drink's picture on a menu's visual. */
export interface MenuPicture {
  id: string;
  name: string;
  imageUrl: string | null;
  isSketch: boolean;
}

/** A menu in the list: enough to group it and draw its row. */
export interface MenuSummary {
  id: string;
  name: string;
  barId: string | null;
  createdBy: string | null;
  coverUrl: string | null;
  coverPosition: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  /** A home menu's night and how many are coming. */
  menuDate: string | null;
  guestCount: number | null;
  /** A home menu shared with a link (/m/<id>) since then; null when it isn't. */
  sharedAt: string | null;
  /** A menu, or an R&D collection (trials, flights): never dated, filed apart. */
  kind: 'menu' | 'rnd';
  itemIds: string[];
  /** The first few drinks' own pictures, for a menu with no cover photo. Null image: drawn from its spec. */
  pictures: MenuPicture[];
  /** The event this menu is for (a takeover), if any. */
  event: { id: string; name: string; startsAt: string } | null;
}

export interface MenuDrink {
  id: string;
  name: string;
  kind: SectionDrinkType;
  /** Ingredients for a cocktail, maker or origin for beer and wine. */
  line: string;
  /** As the venue typed it (items.price is text): "18", "19.50", "MP". */
  price: string | null;
  imageUrl: string | null;
  isSketch: boolean;
  glass: string | null;
}

export interface MenuSectionDetail {
  id: string;
  name: string;
  minItems: number;
  maxItems: number | null;
  allowedTypes: SectionDrinkType[];
  drinks: MenuDrink[];
}

export interface MenuDetail extends Omit<MenuSummary, 'itemIds' | 'pictures' | 'event'> {
  sections: MenuSectionDetail[];
}
