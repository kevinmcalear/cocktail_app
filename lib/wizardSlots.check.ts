import assert from 'node:assert/strict';

import { draftSlot, sectionSlots, slotStart } from './wizardSlots';

// A plain New drink keeps the place's one draft, as before.
assert.equal(draftSlot('home', {}), 'home');
assert.equal(draftSlot('bar-1', { name: '  ' }), 'bar-1');

// Make "Salty Boy" from a menu section is its own draft, whatever was left at home.
const salty = draftSlot('home', { menuSectionId: 's1', name: 'Salty Boy ' });
assert.equal(salty, 'home|menu:s1|name:salty boy');
assert.notEqual(salty, draftSlot('home', { menuSectionId: 's1', name: 'Paloma' }));
assert.notEqual(draftSlot('home', { name: 'Paloma' }), 'home');
assert.equal(draftSlot('home', { from: 'd1' }), 'home|from:d1');

// A section's slots: only that section's, at that place, newest first; s1 doesn't match s10.
const kept = {
  home: { updatedAt: 5 },
  [salty]: { updatedAt: 1 },
  'home|menu:s1|name:paloma': { updatedAt: 3 },
  'home|menu:s1': { updatedAt: 2 },
  'home|menu:s10|name:negroni': { updatedAt: 9 },
  'bar-1|menu:s1|name:salty boy': { updatedAt: 9 },
};
assert.deepEqual(
  sectionSlots(kept, 'home', 's1').map((s) => s.slot),
  ['home|menu:s1|name:paloma', 'home|menu:s1', salty]
);
assert.deepEqual(sectionSlots(kept, 'home', 's2'), []);
// Opening it again with the name it was started with is the same slot.
for (const { slot, name } of sectionSlots(kept, 'home', 's1')) assert.equal(draftSlot('home', { menuSectionId: 's1', name }), slot);

// New's Drafts open a slot with what it was started from.
{
  const slot = draftSlot('bar-1', { menuSectionId: 'sec-9', name: 'Salty Boy' });
  assert.deepEqual(slotStart(slot), { place: 'bar-1', menuSectionId: 'sec-9', from: null, name: 'salty boy' });
  assert.deepEqual(slotStart('home'), { place: 'home', menuSectionId: null, from: null, name: null });
}
