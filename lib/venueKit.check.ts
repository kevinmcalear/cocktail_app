import assert from 'node:assert/strict';

import { houseIce, iceDrawKind, iceMm, ICE_KINDS, isVenueIce, kitIceRow, iceLooksLine, iceName, kitSourceLine, supplierLine, toolName, venueIceKinds, venueIceNames } from './venueKit';

// The drawings' kinds less 'none' (item_ice.draw_as, private.house_ice): keep them in step.
assert.deepEqual([...ICE_KINDS], ['cubes', 'large', 'spear', 'crushed', 'pebble', 'shaved', 'sphere']);

assert.equal(supplierLine({ supplies: ['glassware', 'bottles'], order_by: 'Tue 2 pm', delivers: null }), 'Bottles and glassware · Order by Tue 2 pm');
assert.equal(supplierLine({ supplies: [], order_by: null, delivers: 'Wed and Fri' }), 'Delivers Wed and Fri');
assert.equal(supplierLine({ supplies: [], order_by: null, delivers: null }), '');

assert.equal(kitSourceLine({ source: 'made', note: 'cut from our block', supplier_name: null }), 'Made here · cut from our block');
assert.equal(kitSourceLine({ source: 'machine', machine: 'Hoshizaki under the well', note: null, supplier_name: null }), 'Our machine · Hoshizaki under the well');
assert.equal(kitSourceLine({ source: 'bought', note: null, supplier_name: 'Coldwater Ice Co.' }), 'Bought from Coldwater Ice Co.');
assert.equal(kitSourceLine({ source: 'bought', note: null, supplier_name: null }), 'Bought', 'a supplier this person can\'t see');
assert.equal(kitSourceLine({ source: 'ours', note: null, supplier_name: null }), 'Already ours');
assert.equal(kitSourceLine({ source: null, note: null, supplier_name: null }), '');
assert.equal(kitSourceLine({ source: 'bought', note: 'Collins spears', supplier_name: 'Coldwater Ice Co.', length_mm: 130 }), 'Bought from Coldwater Ice Co. · Collins spears · 130 mm');

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

// The Add sheet's names (Kit and ice, step 4): clear and the size say themselves; a block's is its length.
assert.equal(iceName({ shape: 'large', size_mm: 50, clear: true }), 'Clear cube · 50 mm');
assert.equal(iceName({ shape: 'large', size_mm: null, clear: null }), 'Large cube');
assert.equal(iceName({ shape: 'spear', size_mm: 30, length_mm: 120, clear: false }), 'Collins block · 120 mm');
assert.equal(iceName({ shape: 'sphere', size_mm: 60, clear: true }), 'Clear sphere · 60 mm');
assert.equal(iceName({ shape: 'block', length_mm: 500, clear: true }), 'Block · 500 mm');
assert.equal(iceName({ shape: 'crushed', size_mm: 9 }), 'Crushed', 'crushed has no size');
assert.equal(iceName({ shape: 'other' }), '', 'something else is named by the bar');
assert.equal(iceMm({ shape: 'spear', size_mm: 30, length_mm: 120 }), 120);
assert.equal(iceLooksLine({ shape: 'large', size_mm: 50, clear: true, stamped: true }), 'Large cube · 50 mm · clear · stamped');
assert.equal(iceLooksLine({ shape: 'cubes', clear: false, frozen_inside: 'A viola' }), 'Cubes · cloudy · A viola inside');

assert.equal(toolName({ name: null, key: 'jigger' }), 'Jigger');
assert.equal(toolName({ name: 'Ice stamp', key: null }), 'Ice stamp');
