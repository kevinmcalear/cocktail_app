import assert from 'node:assert/strict';

import type { EndedRun, ListRow } from '@/hooks/useLivingList';
import type { MenuDrink } from '@/types/menus';

import { liveList } from './liveList';
import type { PageRowView } from './MenuPageRow';

const drink = (id: string): MenuDrink => ({ id, name: id, kind: 'cocktail', line: '', price: null, imageUrl: null, isSketch: false, glass: null });
const view = (id: string): PageRowView => ({ drink: drink(id), line: '', end: null, endTone: 'ink', sub: null, flag: null, chips: null, talkingPoint: null, ink: 'colour' });
const row = (itemId: string, o: Partial<ListRow> = {}): ListRow => ({
  id: `r-${itemId}`, itemId, sectionId: 's', sortOrder: 0, price: null, slotName: null, onFrom: null, offAt: null, addedBy: null, offBy: null, replacesItemId: null, teamSharedAt: null, state: 'on', ...o,
});
const now = Date.parse('2026-11-01T18:00:00Z');
const base = { sectionIds: new Map([['Shaken', 's']]), userId: 'me', nameOf: (id: string | null) => (id === 'sam' ? 'Sam' : null), day: (iso: string) => iso.slice(5, 10), time: () => '4pm', listStart: '2026-10-01T00:00:00Z', now };
const ended = (itemId: string): EndedRun => ({ itemId, sectionName: 'Shaken', slotName: null, price: null, wentOn: '2026-10-01T00:00:00Z', cameOff: '2026-11-01T16:00:00Z', takenOffBy: 'me', addedBy: null, replacesItemId: null });

// A swap done today: the new drink on, the old one struck after it, with Undo.
let out = liveList({
  ...base,
  sections: [{ id: 's', name: 'Shaken', rows: [view('bees'), view('daiquiri')] }],
  rows: [row('bees', { onFrom: '2026-11-01T16:00:00Z', replacesItemId: 'jack' }), row('daiquiri')],
  ended: [ended('jack')],
  endedDrinks: new Map([['jack', drink('jack')]]),
  may: true,
});
assert.deepEqual(out.main[0].rows.map((r) => [r.drink.id, !!r.struck]), [['bees', false], ['jack', true], ['daiquiri', false]]);
assert.equal(out.main[0].rows[0].flag?.label, 'New');
assert.equal(out.main[0].rows[2].sub, 'since 10-01');
assert.deepEqual(out.main[0].rows[1].acts?.map((a) => a.kind), ['undo']);

// Waiting: on top for someone who may change the list, with Approve; a planned drink under Coming up.
out = liveList({
  ...base,
  sections: [{ id: 's', name: 'Shaken', rows: [view('bees'), view('spritz')] }],
  rows: [row('bees', { state: 'waiting_on', addedBy: 'sam' }), row('spritz', { state: 'coming', onFrom: '2026-11-06T00:00:00Z' })],
  ended: [],
  endedDrinks: new Map(),
  may: true,
});
assert.equal(out.lead?.name, 'Waiting for you');
assert.equal(out.lead?.rows[0].line, 'Sam asked · to go on');
assert.deepEqual(out.lead?.rows[0].acts?.map((a) => a.kind), ['approve', 'turnDown']);
assert.equal(out.main[0].rows.length, 0);
assert.equal(out.coming?.rows[0].flag?.label, '11-06');

// Back on after Undo: no struck row.
out = liveList({ ...base, sections: [{ id: 's', name: 'Shaken', rows: [view('jack')] }], rows: [row('jack')], ended: [ended('jack')], endedDrinks: new Map([['jack', drink('jack')]]), may: true });
assert.equal(out.main[0].rows.length, 1);

console.log('liveList ok');
