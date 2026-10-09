import assert from 'node:assert/strict';

import { barSection, madeLine, type BarSection, type Sortable } from './barSections';

const cases: [Sortable, BarSection][] = [
  [{ name: 'London Dry Gin', kind: 'Gin', role: 'generic', abv: 42 }, 'bottles'],
  [{ name: 'Gin', role: 'generic', abv: 40 }, 'bottles'],
  [{ name: 'Metoro Joven Mezcal' }, 'bottles'],
  [{ name: 'Gospel Straight Rye', role: 'product' }, 'bottles'],
  [{ name: 'Angostura Bitters', role: 'product', abv: 44.7 }, 'bottles'],
  [{ name: 'Bickford’s Lime Cordial', role: 'product' }, 'bottles'],
  [{ name: 'Lemon', kind: 'Citrus', role: 'generic' }, 'fridge'],
  [{ name: 'Heavy Cream', kind: 'Cream', role: 'generic', abv: 0 }, 'fridge'],
  [{ name: 'Whole Milk', role: 'generic' }, 'fridge'],
  [{ name: 'Soda Water', role: 'generic', abv: 0 }, 'fridge'],
  [{ name: 'Ginger Beer', role: 'generic', abv: 0 }, 'fridge'],
  [{ name: 'Water' }, 'fridge'],
  [{ name: 'Sugar' }, 'fridge'],
  [{ name: 'Coffee', role: 'generic', abv: 0 }, 'fridge'],
  [{ name: 'Malic Acid', kind: 'Acid', role: 'generic' }, 'lab'],
  [{ name: 'Citric Acid', kind: 'Acid', role: 'generic' }, 'lab'],
  [{ name: 'Lactic Acid', role: 'generic' }, 'lab'],
  [{ name: 'Pectinex Ultra SP-L' }, 'lab'],
  [{ name: 'Agar', role: 'generic' }, 'lab'],
  [{ name: 'Xanthan Gum', role: 'generic' }, 'lab'],
  [{ name: 'MSG', role: 'generic' }, 'lab'],
  [{ name: 'Lime Cordial', role: 'prep', hasRecipe: true }, 'preps'],
  [{ name: 'Citric Acid Solution', role: 'prep', hasRecipe: true }, 'preps'],
  [{ name: 'Saline Solution (10%)', role: 'prep' }, 'preps'],
  [{ name: 'Acid-Adjusted Grapefruit Cordial', hasRecipe: true }, 'preps'],
  [{ name: 'Simple Syrup', role: 'prep', abv: 0 }, 'preps'],
  [{ name: 'Lime and Lemon Cordial' }, 'preps'],
  [{ name: 'Monin Vanilla Syrup', role: 'product' }, 'bottles'],
  [{ name: 'Citric Acid' }, 'lab'],
];
for (const [item, want] of cases) assert.equal(barSection(item), want, item.name);

const now = new Date(2026, 9, 9, 15);
assert.equal(madeLine(new Date(2026, 9, 9, 8).toISOString(), now), 'Made today');
assert.equal(madeLine(new Date(2026, 9, 8, 23).toISOString(), now), 'Made yesterday');
assert.equal(madeLine(new Date(2026, 9, 3, 12).toISOString(), now), 'Made 3 Oct');
assert.equal(madeLine(new Date(2025, 11, 30, 12).toISOString(), now), 'Made 30 Dec 2025');
assert.equal(madeLine(null, now), null);

console.log('barSections: ok');
