import type { PresentationRecipe, SpecLevels } from '@/lib/spec';
import type { DatabaseItem } from '@/types/types';

export { IMAGES as SAMPLE_IMAGES } from './samples';

// A sample venue drink for /dev/drink, masked the way app_recipe_presentation
// masks it for each role. The spec is the widely published Penicillin.

export const SAMPLE_LEVELS: SpecLevels = { generic: 20, brand: 30, measurement: 30, prep: 40 };

const ROWS = [
  { id: 'r1', brand: 'Monkey Shoulder', generic: 'Blended Scotch', amount: 60, unit: 'ml', note: null },
  { id: 'r2', brand: 'Lemon juice', generic: 'Lemon juice', amount: 22.5, unit: 'ml', note: 'Juiced this afternoon' },
  { id: 'r3', brand: 'Honey-ginger syrup', generic: 'Honey-ginger syrup', amount: 22.5, unit: 'ml', note: '2:1 honey, fresh ginger juice' },
  { id: 'r4', brand: 'Laphroaig 10', generic: 'Islay Scotch', amount: 7.5, unit: 'ml', note: 'Float off a bar spoon' },
];

function masked(role: number): PresentationRecipe[] {
  return ROWS.map((r, i) => {
    const brand = role >= SAMPLE_LEVELS.brand;
    const generic = role >= SAMPLE_LEVELS.generic;
    const amounts = role >= SAMPLE_LEVELS.measurement;
    const display = brand ? { id: `b-${r.id}`, name: r.brand } : generic ? { id: `g-${r.id}`, name: r.generic } : null;
    return {
      id: r.id,
      sort_order: i,
      amount: amounts ? r.amount : null,
      unit: amounts ? r.unit : null,
      preparation_notes: role >= SAMPLE_LEVELS.prep ? r.note : null,
      display_ingredient_id: display?.id ?? null,
      display_ingredient: display,
    };
  });
}

export function sampleDrink(role: number): DatabaseItem {
  return {
    id: 'sample-penicillin',
    name: 'Penicillin',
    item_type: 'cocktail',
    description: 'Blended Scotch, lemon and honey-ginger, shaken, with a float of smoky Islay on top.',
    created_at: '2026-09-25T00:00:00Z',
    glassware_id: null,
    family_id: null,
    ice_id: null,
    notes: 'Created by Sam Ross at Milk & Honey, New York, in 2005, as a riff on the Gold Rush.',
    origin: 'Modern Classic',
    price: null,
    status: null,
    brand_maker: null,
    abv: null,
    bar_id: 'sample-venue',
    override_visibility_level: null,
    override_generic_ingredient_level: null,
    override_specific_brand_level: null,
    override_measurement_level: null,
    override_prep_level: null,
    item_images: [],
    recipes: masked(role) as never,
  };
}
