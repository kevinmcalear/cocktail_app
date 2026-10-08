// My Bar's fridge and pantry, and how the shelf of bottles is searched and
// sorted. Pantry staples are ordinary shelf rows (home_bar_items) for shared
// core ingredients, so my_bar_drinks counts them like any bottle: a sour
// needs a lemon, and a syrup's recipe needs sugar and water.

/** The staples, as the button says them and as the shared ingredient is named. */
export const PANTRY = [
  { label: 'Lemons', name: 'Lemon' },
  { label: 'Limes', name: 'Lime' },
  { label: 'Oranges', name: 'Orange' },
  { label: 'Grapefruit', name: 'Grapefruit' },
  { label: 'Sugar', name: 'Sugar' },
  { label: 'Honey', name: 'Honey' },
  { label: 'Eggs', name: 'Egg' },
  { label: 'Soda water', name: 'Soda Water' },
  { label: 'Mint', name: 'Mint' },
] as const;

/** Every house syrup is sugar or honey and water: added with any staple, never shown. */
export const PANTRY_WATER = 'Water';

export type ShelfSort = 'newest' | 'used' | 'unused' | 'az' | 'style';

export interface ShelfBottle {
  id: string;
  name: string;
  /** What it's a kind of ("Bourbon"), for sorting by style. */
  kind: string | null;
  /** How many drinks you can make with it. */
  uses: number;
}

/**
 * The shelf narrowed to names (or styles) containing the text, in the chosen
 * order. Newest is the order given; Unused is only the bottles no drink you
 * can make needs, newest first.
 */
export function arrangeShelf<T extends ShelfBottle>(bottles: T[], sort: ShelfSort, text: string): T[] {
  const q = text.trim().toLowerCase();
  const found = q ? bottles.filter((b) => b.name.toLowerCase().includes(q) || !!b.kind?.toLowerCase().includes(q)) : bottles;
  if (sort === 'newest') return found;
  if (sort === 'unused') return found.filter((b) => b.uses === 0);
  const byName = (a: T, b: T) => a.name.localeCompare(b.name);
  if (sort === 'az') return [...found].sort(byName);
  if (sort === 'used') return [...found].sort((a, b) => b.uses - a.uses || byName(a, b));
  // Styles A to Z, bottles without one last.
  return [...found].sort((a, b) => Number(!a.kind) - Number(!b.kind) || (a.kind ?? '').localeCompare(b.kind ?? '') || byName(a, b));
}

/** "Bourbon · 45.2%", "Fratelli Branca · 30%", or just the style. */
export function bottleLine({ kind, maker, abv }: { kind: string | null; maker: string | null; abv: number | null }): string {
  return [maker || kind, abv != null ? `${abv}%` : null].filter(Boolean).join(' · ');
}
