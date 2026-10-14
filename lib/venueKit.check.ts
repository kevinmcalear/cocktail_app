import assert from 'node:assert/strict';

import { EQUIPMENT } from './techniques/equipment';
import { ICE_KINDS, isVenueIce, kitSourceLine, supplierLine, toolGroups, venueIceNames } from './venueKit';

// The database's bar_kit_key_check list, less nothing: keep them in step.
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

assert.equal(kitSourceLine({ made_here: true, note: 'Hoshizaki under the well', supplier_name: null }), 'Made here · Hoshizaki under the well');
assert.equal(kitSourceLine({ made_here: false, note: null, supplier_name: 'Coldwater Ice Co.' }), 'Coldwater Ice Co.');
assert.equal(kitSourceLine({ made_here: false, note: null, supplier_name: null }), '');

// The wizard's Ice step: the venue's ice by the wizard's names, tools left out.
const names = venueIceNames([{ kind: 'ice', key: 'large' }, { kind: 'tool', key: 'shaker' }, { kind: 'ice', key: 'cubes' }]);
assert.deepEqual(names, ['Large cube', 'Cubes']);
assert.ok(isVenueIce(names, ' large cube'));
assert.ok(!isVenueIce(names, 'Crushed'));
