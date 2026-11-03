// My Bar's words for each section: titles, the Add tiles, notes and blurbs.
// Apart from lib/barSections.ts (which sorts a thing into its section and is
// on every page through the shopping list), so only the Shelf's own code
// carries them.

import type { BarSection } from './barSections';

/**
 * `short`: the name in the section filters. `add` and `addSub`: the section's
 * Add tile. `note`: the muted line under the title on My Bar (none for Bottles).
 */
// Bottles' title is the Shelf's head as the Drinks board draws it (Spirits); the chips and the add sheet, which also
// hold wine, beer and bitters, call it by `short`.
export const SECTIONS: Record<BarSection | 'kit', { title: string; short: string; add: string; addSub: string; note: string; blurb: string; empty: string }> = {
  bottles: { title: 'Spirits', short: 'Bottles', add: 'Add bottles', addSub: 'Search or snap', note: '', blurb: 'Spirits, liqueurs, wine, beer and bitters.', empty: 'Spirits, liqueurs, wine and bitters.' },
  fridge: { title: 'Fridge & pantry', short: 'Fridge', add: 'Add to fridge', addSub: 'Milk, pineapple…', note: 'Counted as on hand, so a sour isn’t blocked by a lemon.', blurb: 'Tap the staples you keep. Anything else (milk, pineapple, coffee) comes in from Add.', empty: '' },
  lab: { title: 'Lab shelf', short: 'Lab', add: 'Add to lab', addSub: 'Acids, enzymes', note: 'Acids, enzymes and texture: for cordials, clarifying and foams.', blurb: 'Acids, enzymes and texture: for cordials, acid-adjusting, clarifying and foams.', empty: 'Acids and enzymes, for when you get curious.' },
  preps: { title: 'Made at home', short: 'Made at home', add: 'Make something', addSub: 'Or open a recipe', note: '', blurb: 'What you’ve made and have in the fridge. They count like bottles.', empty: 'Syrups and cordials you make yourself.' },
  kit: { title: 'Kit', short: 'Kit', add: 'Add kit', addSub: 'Tools, scales', note: 'Pots, jars, a fridge and a freezer are taken as given.', blurb: 'Pots, jars, strainers, a fridge and a freezer are taken as given.', empty: 'Scales, whippers and beyond.' },
};
