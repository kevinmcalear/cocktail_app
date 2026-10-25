import assert from 'node:assert/strict';

import { EQUIPMENT } from './techniques/equipment';
import { houseIce, iceDrawKind, ICE_KINDS, isVenueIce, kitIceRow, kitSourceLine, supplierLine, toolGroups, venueIceKinds, venueIceNames } from './venueKit';

// The drawings' kinds less 'none' (item_ice.draw_as, private.house_ice): keep them in step.
assert.deepEqual([...ICE_KINDS], ['cubes', 'large', 'spear', 'crushed', 'pebble', 'shaved', 'sphere']);

// Every bar tool behind the bar; the prep kitchen's common few are real ids.
const [bar, prep] = toolGroups([], false);
assert.deepEqual(bar.ids, EQUIPMENT.filter((e) => e.kind === 'bar').map((e) => e.id));
assert.equal(prep.ids.length, 7, 'the seven common prep tools');
for (const id of prep.ids) assert.ok(EQUIPMENT.some((e) => e.id === id), id);
// A tool the venue has always shows; "all" shows every one.
assert.ok(toolGroups(['pacojet'], false)[1].ids.includes('pacojet'));
assert.equal(toolGroups([], true).flatMap((g) => g.ids).length, EQUIPMENT.length);

assert.equal(supplierLine({ supplies: ['glassware', 'bottles'], order_by: 'Tue 2 pm', delivers: null }), 'Bottles and glassware · Order by Tue 2 pm');
assert.equal(supplierLine({ supplies: [], order_by: null, delivers: 'Wed and Fri' }), 'Delivers Wed and Fri');
assert.equal(supplierLine({ supplies: [], order_by: null, delivers: null }), '');

assert.equal(kitSourceLine({ source: 'made', note: 'cut from our block', supplier_name: null }), 'Made here · cut from our block');
assert.equal(kitSourceLine({ source: 'machine', machine: 'Hoshizaki under the well', note: null, supplier_name: null }), 'Our machine · Hoshizaki under the well');
assert.equal(kitSourceLine({ source: 'bought', note: null, supplier_name: 'Coldwater Ice Co.' }), 'Coldwater Ice Co.');
assert.equal(kitSourceLine({ source: 'bought', note: null, supplier_name: null }), 'Bought', 'a supplier this person can\'t see');
assert.equal(kitSourceLine({ source: 'ours', note: null, supplier_name: null }), 'Already ours');
assert.equal(kitSourceLine({ source: null, note: null, supplier_name: null }), '');
assert.equal(kitSourceLine({ source: 'bought', note: 'Collins spears', supplier_name: 'Coldwater Ice Co.', length_mm: 130 }), 'Coldwater Ice Co. · Collins spears · 130 mm');

// The wizard's Ice step: the venue's ice in the glass by its names, blocks and slabs left out.
const ice = [
  { name: 'Large cube', shape: 'large', draw_as: null },
  { name: 'Block', shape: 'block', draw_as: null },
  { name: 'Cubes', shape: 'cubes', draw_as: null },
  { name: 'Prism cube', shape: 'other', draw_as: 'large' },
  { name: 'Odd ice', shape: 'other', draw_as: null },
];
const names = venueIceNames(ice);
assert.deepEqual(names, ['Large cube', 'Cubes', 'Prism cube', 'Odd ice']);
assert.ok(isVenueIce(names, ' large cube'));
assert.ok(!isVenueIce(names, 'Crushed'));

// Drawings: the kinds the venue's ice is drawn as (as private.item_sketches_set_house_ice reads them).
assert.deepEqual(venueIceKinds(ice), ['large', 'cubes', 'large']);
assert.equal(iceDrawKind({ shape: 'spear', draw_as: null }), 'spear');
assert.equal(iceDrawKind({ shape: 'cut', draw_as: 'large' }), 'large');
assert.equal(iceDrawKind({ shape: 'slab', draw_as: null }), null);

// Drawings: a guessed ice gives way to the venue's nearest kind.
assert.equal(houseIce('cubes', ['large', 'crushed']), 'large');
assert.equal(houseIce('crushed', ['cubes', 'pebble']), 'pebble');
assert.equal(houseIce('spear', ['crushed']), null, 'nothing near');
assert.equal(houseIce('cubes', ['cubes', 'large']), null, 'the venue has it');
assert.equal(houseIce('none', ['cubes']), null, 'no ice stays no ice');
assert.equal(houseIce('cubes', []), null, 'no ice listed');

// The venue's ice by a wizard pick's name; never a block or slab.
assert.equal(kitIceRow([{ name: 'Spear', shape: 'slab' }, { name: 'Spear', shape: 'spear' }], 'spear')?.shape, 'spear');
assert.equal(kitIceRow(ice, 'Large Cube')?.shape, 'large');
assert.equal(kitIceRow(ice, 'Pebble'), null);
