import assert from 'node:assert/strict';
import { EQUIPMENT, equipmentById, equipmentMatches } from './equipment';

const found = (search: string) => EQUIPMENT.filter((e) => equipmentMatches(e, search)).map((e) => e.id);

// Kevin searched "hydrosonic homogenizer" and the Add sheets found nothing (27 Oct).
assert.deepEqual(found('hydrosonic homogenizer'), ['ultrasonic']);
assert.deepEqual(found('Homogeniser'), ['ultrasonic']);
assert.deepEqual(found('smasher'), ['squasher']);
assert.deepEqual(found('rotovap'), ['rotovap']);
assert.ok(found('immersion circulator').includes('sous-vide'));
// Name and what it's for still match, in any order and case.
assert.ok(found('Vide Sous').includes('sous-vide'));
assert.ok(found('cavitation').includes('ultrasonic'));
// Blank matches everything; a word nothing has matches nothing.
assert.equal(found('  ').length, EQUIPMENT.length);
assert.deepEqual(found('xylophone'), []);

// Other names are for search only: none repeats the name, none is blank.
for (const e of EQUIPMENT) {
  for (const a of e.aka ?? []) {
    assert.ok(a.trim(), `${e.id}: blank other name`);
    assert.ok(!e.name.toLowerCase().includes(a.toLowerCase()), `${e.id}: "${a}" is already in its name`);
  }
}
assert.ok(equipmentById('ultrasonic')?.aka?.includes('homogenizer'));
