import assert from 'node:assert/strict';

import { cleanMenuReading, cleanPrice, MOCK_MENU_REPLY } from '../supabase/functions/_shared/menuRead';

// read-menu (supabase/functions/read-menu) must hand the app a reading it can
// trust, whatever the model sends back.

assert.equal(cleanPrice('$18'), '18');
assert.equal(cleanPrice('19.50'), '19.50');
assert.equal(cleanPrice('£12,5'), '12.5');
assert.equal(cleanPrice('¥1,200'), '1200');
assert.equal(cleanPrice('18 / 90'), '18');
assert.equal(cleanPrice('Market price'), 'MP');
assert.equal(cleanPrice('ask'), null);
assert.equal(cleanPrice(null), null);

const reading = cleanMenuReading({
  title: '  SPRING  ',
  sections: [
    { name: 'Signatures:', drinks: [{ name: ' Paper\nPlane — ', price: '$18', ingredients: [' Bourbon ', '', 7, 'Aperol'] }, { name: '', ingredients: [] }] },
    // The same heading on the next page carries on the section.
    { name: 'Signatures', drinks: [{ name: 'Negroni', price: null, ingredients: [] }] },
    { name: 'Food', drinks: [] },
    { name: null, drinks: [{ name: 'Daiquiri' }] },
    'junk',
  ],
});
assert.equal(reading.title, 'SPRING');
assert.deepEqual(reading.sections, [
  {
    name: 'Signatures',
    lines: [
      { name: 'Paper Plane', price: '18', ingredients: ['Bourbon', 'Aperol'] },
      { name: 'Negroni', price: null, ingredients: [] },
    ],
  },
  { name: null, lines: [{ name: 'Daiquiri', price: null, ingredients: [] }] },
]);

assert.deepEqual(cleanMenuReading(null), { title: null, sections: [] });
assert.deepEqual(cleanMenuReading({ sections: 'nope' }), { title: null, sections: [] });

// A runaway reply is capped.
const many = cleanMenuReading({ sections: [{ name: 'All', drinks: Array.from({ length: 500 }, (_, i) => ({ name: `Drink ${i}`, ingredients: Array(40).fill('Gin') })) }] });
assert.equal(many.sections[0].lines.length, 120);
assert.equal(many.sections[0].lines[0].ingredients.length, 12);

// The local mock is a real reading: two sections, every drink priced.
const mock = cleanMenuReading(MOCK_MENU_REPLY);
assert.deepEqual(mock.sections.map((s) => s.name), ['Signatures', 'Classics']);
assert.ok(mock.sections.every((s) => s.lines.every((l) => l.price)));

console.log('menuRead checks passed');
