import type { SectionDrinkType } from '@/lib/sectionAllowedTypes';

/** Where a menu is in its life, worked out from its dates (lib/menus.ts). */
export type MenuStatus = 'draft' | 'upcoming' | 'on' | 'previous';

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
  itemIds: string[];
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

export interface MenuDetail extends Omit<MenuSummary, 'itemIds' | 'event'> {
  sections: MenuSectionDetail[];
}
