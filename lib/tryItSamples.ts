import { familyHues } from '@/constants/tokens';
import { BRAND_SAMPLE, sampleSketch } from '@/lib/brandSample';
import type { SketchInputs } from '@/lib/sketch/types';
import type { VenueFeatureKey } from '@/lib/venueFeatures';
import type { MenuDrink } from '@/types/menus';

/**
 * What Venue settings › Features › Try it shows (canvas first-round-and-features,
 * "Try it"): a sample of the feature, bundled in the app and never saved.
 * Only features with `tryIt` in the catalog (lib/venueFeatures.ts) have one.
 */
export type TryItKey = Extract<VenueFeatureKey, 'tonight' | 'backBar'>;

export const TRY_IT_COPY: Record<TryItKey, { eyebrow: string; line: string }> = {
  tonight: {
    eyebrow: 'Try it · a sample menu, nothing is saved',
    line: 'The shift opens on tonight’s menu, in running order, with what’s new marked.',
  },
  backBar: {
    eyebrow: 'Try it · sample bottles, nothing is saved',
    line: 'Tick what’s on your shelf. Specs then show what you can pour right now.',
  },
};

// --- Back bar ---

export interface SampleBottle {
  id: string;
  name: string;
  /** What it is, and what its drawing is drawn from (IngredientDrawing by name). */
  kind: string;
  /** Ticked when the sheet opens. */
  have: boolean;
}

/** The six bottles the canvas draws, ticked as it draws them. */
export const SAMPLE_BOTTLES: readonly SampleBottle[] = [
  { id: 'rye', name: 'Rittenhouse Rye', kind: 'Rye whiskey', have: true },
  { id: 'bourbon', name: 'Buffalo Trace', kind: 'Bourbon', have: true },
  { id: 'campari', name: 'Campari', kind: 'Bitter liqueur', have: true },
  { id: 'vermouth', name: 'Cocchi Vermouth di Torino', kind: 'Sweet vermouth', have: false },
  { id: 'angostura', name: 'Angostura', kind: 'Bitters', have: true },
  { id: 'chartreuse', name: 'Green Chartreuse', kind: 'Herbal liqueur', have: false },
];

/**
 * The venue's Old Fashioned: rye, demerara and Angostura. Demerara syrup is
 * made in house, not a bottle on the shelf, so the sample counts it as there.
 */
export const OLD_FASHIONED: readonly { name: string; bottle: string | null }[] = [
  { name: 'rye', bottle: 'rye' },
  { name: 'demerara', bottle: null },
  { name: 'Angostura', bottle: 'angostura' },
];

export const OLD_FASHIONED_SKETCH: SketchInputs = sampleSketch('rocks', 'large', familyHues.dark.oldfashioned, 'orange_peel');

/** The line under the bottles: what the Old Fashioned still needs, from what's ticked. */
export function oldFashionedLine(ticked: readonly string[]): string {
  const missing = OLD_FASHIONED.filter((p) => p.bottle && !ticked.includes(p.bottle)).map((p) => p.name);
  if (missing.length === 0) return 'Your Old Fashioned: everything in stock';
  return `Your Old Fashioned: out of ${missing.join(' and ')}`;
}

/** Tick or untick one bottle, keeping the rest. */
export function toggleBottle(ticked: readonly string[], id: string): string[] {
  return ticked.includes(id) ? ticked.filter((t) => t !== id) : [...ticked, id];
}

// --- Tonight ---

/** Tonight's sample menu: the brand preview's three drinks, drawn from their own inputs. */
export const SAMPLE_MENU = {
  name: 'Autumn menu',
  section: 'Stirred and strong',
  drinks: BRAND_SAMPLE.map(
    (d, i): MenuDrink & { isNew: boolean; sketch: SketchInputs } => ({
      id: `sample-${i}`,
      name: d.name,
      kind: 'cocktail',
      line: d.line,
      price: d.price,
      imageUrl: null,
      isSketch: true,
      glass: d.sketch.glass === 'martini' ? 'Martini' : 'Rocks',
      isNew: d.isNew,
      sketch: d.sketch,
    }),
  ),
};
