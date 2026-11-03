import assert from 'node:assert/strict';

import type { ListAsk } from '@/hooks/useListAsks';
import type { EndedRun, ListRow } from '@/hooks/useLivingList';
import type { MenuDrink } from '@/types/menus';

import { liveList, runRange } from './liveList';
import { splitGroup, type ModelGroupRow } from './menuPageModel';
import type { PageRowView } from './MenuPageRow';

const drink = (id: string): MenuDrink => ({ id, name: id, kind: 'cocktail', line: '', price: null, imageUrl: null, isSketch: false, glass: null });
const view = (id: string): PageRowView => ({ drink: drink(id), line: '', end: null, endTone: 'ink', sub: null, flag: null, chips: null, talkingPoint: null, ink: 'colour' });
const row = (itemId: string, o: Partial<ListRow> = {}): ListRow => ({
  id: `r-${itemId}`, itemId, sectionId: 's', sortOrder: 0, price: null, slotName: null, onFrom: null, offAt: null, addedBy: null, offBy: null, replacesItemId: null, teamSharedAt: null, addedAt: '2026-11-01T14:05:00Z', state: 'on', ...o,
});
const now = Date.parse('2026-11-01T18:00:00Z');
const base = { bartender: false, asks: [] as ListAsk[], offTonight: [], pullsTonight: false, closesAt: null as string | null, living: true, sectionIds: new Map([['Shaken', 's']]), userId: 'me', nameOf: (id: string | null) => (id === 'sam' ? 'Sam' : null), day: (iso: string) => iso.slice(5, 10), time: () => '4pm', listStart: '2026-10-01T00:00:00Z', now };
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
assert.equal(out.lead?.rows[0].line, 'Sam asked at 4pm · to go on');
assert.deepEqual(out.lead?.rows[0].acts?.map((a) => a.kind), ['approve', 'turnDown']);
assert.equal(out.main[0].rows.length, 0);
assert.equal(out.coming?.rows[0].flag?.label, '11-06');

// Taken off, put back and taken off again today (an approved ask after an Undo): one struck row, the latest run's.
out = liveList({
  ...base,
  sections: [{ id: 's', name: 'Shaken', rows: [view('daiquiri')] }],
  rows: [row('daiquiri')],
  ended: [{ ...ended('jack'), cameOff: '2026-11-01T17:00:00Z', wentOn: '2026-11-01T16:30:00Z' }, ended('jack')],
  endedDrinks: new Map([['jack', drink('jack')]]),
  may: true,
});
assert.deepEqual(out.main[0].rows.map((r) => [r.drink.id, !!r.struck]), [['daiquiri', false], ['jack', true]]);
assert.equal(out.main[0].rows[1].line, 'Off today · its run is kept: 11-01 to 11-01');

// Back on after Undo: no struck row.
out = liveList({ ...base, sections: [{ id: 's', name: 'Shaken', rows: [view('jack')] }], rows: [row('jack')], ended: [ended('jack')], endedDrinks: new Map([['jack', drink('jack')]]), may: true });
assert.equal(out.main[0].rows.length, 1);

// The last change names both sides of a swap, and a struck row doesn't change what's on.
out = liveList({
  ...base,
  sections: [{ id: 's', name: 'Shaken', rows: [view('bees')] }],
  rows: [row('bees', { onFrom: '2026-11-01T16:00:00Z', replacesItemId: 'jack' })],
  ended: [ended('jack')],
  endedDrinks: new Map([['jack', drink('jack')]]),
  may: true,
});
assert.equal(out.lastChange, 'today 4pm · bees for jack');

// A drink put on as the menu was set up (before it went on) isn't a change: no Last change yet.
out = liveList({ ...base, sections: [{ id: 's', name: 'Shaken', rows: [view('bees')] }], rows: [row('bees', { onFrom: '2026-09-30T16:00:00Z' })], ended: [], endedDrinks: new Map(), may: true });
assert.equal(out.lastChange, null);

// A seasonal list keeps each drink's cost; a drink planned for later does on either.
const costed = { ...view('bees'), sub: '19% cost' };
out = liveList({
  ...base,
  living: false,
  sections: [{ id: 's', name: 'Shaken', rows: [costed, { ...view('spritz'), sub: '21% cost' }] }],
  rows: [row('bees'), row('spritz', { state: 'coming', onFrom: '2026-11-06T00:00:00Z' })],
  ended: [],
  endedDrinks: new Map(),
  may: true,
});
assert.equal(out.main[0].rows[0].sub, '19% cost');
assert.equal(out.coming?.rows[0].sub, '21% cost');

// A living list keeps the cost too (Menu-who-creator); a row with no cost says how long it has been on.
out = liveList({ ...base, sections: [{ id: 's', name: 'Shaken', rows: [costed, view('jack')] }], rows: [row('bees'), row('jack')], ended: [], endedDrinks: new Map(), may: true });
assert.equal(out.main[0].rows[0].sub, '19% cost');
assert.match(out.main[0].rows[1].sub ?? '', /^since /);

// A bartender's asks (Menu-l-ask): their draft first, in pencil, then a swap they asked for; the drink it takes off stays on and says so.
const ask = (o: Partial<ListAsk>): ListAsk => ({ id: 'a', menuId: 'm', itemId: null, drink: null, offItemId: null, sectionId: 's', at: null, price: null, askedAt: null, createdBy: 'me', createdAt: '2026-11-01T14:00:00Z', ...o });
const asks = [ask({ id: 'swap', itemId: 'bees', drink: drink('bees'), offItemId: 'jack', askedAt: '2026-11-01T14:05:00Z' }), ask({ id: 'draft', itemId: 'spritz', drink: drink('spritz') })];
out = liveList({ ...base, bartender: true, may: false, asks, sections: [{ id: 's', name: 'Shaken', rows: [view('jack'), view('daiquiri')] }], rows: [row('jack'), row('daiquiri')], ended: [], endedDrinks: new Map() });
assert.equal(out.lead?.name, 'Your changes');
assert.deepEqual(out.lead?.rows.map((r) => [r.drink.id, r.flag?.label, r.ink]), [['spritz', 'Draft', 'pencil'], ['bees', 'Waiting', 'colour']]);
assert.equal(out.lead?.rows[0].line, 'Only you see this · no price yet');
assert.deepEqual(out.lead?.rows[0].acts?.map((a) => a.kind), ['ask', 'withdraw']);
assert.equal(out.lead?.rows[1].line, 'On in place of jack · you asked at 4pm');
assert.deepEqual(out.main[0].rows.map((r) => [r.drink.id, r.flag?.label ?? null, r.line, r.sub]), [['jack', 'Waiting to come off', 'Stays on until it is approved', null], ['daiquiri', null, '', null]]);
assert.deepEqual(out.main[0].rows[1].acts?.map((a) => a.kind), ['swap', 'takeOff'], 'a bartender asks; Off tonight is the menu team’s');

// The menu team see the same swap as two rows to approve (Menu-l-approve), after tonight.
const tonight = new Date(now + 8 * 3_600_000).toISOString();
out = liveList({ ...base, closesAt: tonight, nameOf: () => 'Sam', asks: [ask({ itemId: 'bees', drink: drink('bees'), offItemId: 'jack', at: tonight, askedAt: '2026-11-01T14:05:00Z', createdBy: 'sam' })], sections: [{ id: 's', name: 'Shaken', rows: [view('jack')] }], rows: [row('jack')], ended: [], endedDrinks: new Map(), may: true });
assert.equal(out.lead?.name, 'Waiting for you');
assert.deepEqual(out.lead?.rows.map((r) => [r.drink.id, r.line]), [['bees', 'Sam asked at 4pm · on in place of jack'], ['jack', 'Sam asked at 4pm · off after tonight']]);
assert.deepEqual(out.lead?.rows[1].acts?.map((a) => a.kind), ['approve', 'turnDown']);
assert.equal(out.main[0].rows[0].flag?.label, 'Waiting');

// Off tonight: faded on the list with Back on; the third act on any other drink.
out = liveList({ ...base, offTonight: [{ id: 'o', menuId: 'm', itemId: 'jack', until: tonight }], sections: [{ id: 's', name: 'Shaken', rows: [view('jack'), view('daiquiri')] }], rows: [row('jack'), row('daiquiri')], ended: [], endedDrinks: new Map(), may: true, pullsTonight: true });
assert.deepEqual([out.main[0].rows[0].flag?.label, out.main[0].rows[0].ink, out.main[0].rows[0].acts?.map((a) => a.kind)], ['Not tonight', 'faded', ['backOn']]);
assert.deepEqual(out.main[0].rows[1].acts?.map((a) => a.label), ['Swap', 'Take off', 'Off tonight']);
// A bartender on shift pulls a drink for tonight too; their swaps are still asks.
out = liveList({ ...base, bartender: true, offTonight: [{ id: 'o', menuId: 'm', itemId: 'jack', until: tonight }], sections: [{ id: 's', name: 'Shaken', rows: [view('jack'), view('daiquiri')] }], rows: [row('jack'), row('daiquiri')], ended: [], endedDrinks: new Map(), may: false, pullsTonight: true });
assert.deepEqual(out.main[0].rows[0].acts?.map((a) => a.kind), ['backOn']);
assert.deepEqual(out.main[0].rows[1].acts?.map((a) => a.label), ['Swap', 'Take off', 'Off tonight']);

// Dates on a run, from a date column or a timestamp.
assert.equal(runRange('2026-09-01', '2026-09-30'), new Date(2026, 8, 1).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }).startsWith('1') ? '1 to 30 Sep' : 'Sep 1 to 30');
assert.ok(runRange('2026-10-01', '2026-11-01', true).endsWith(' 2026'));
assert.ok(!runRange('2026-11-01T15:00:00Z', '2026-11-01T18:00:00Z').includes(' to ')); // On and off the same day: one date

// Rows the board keeps off the top go after the drinks: an Admin's Run sheet, and on a living list the bar page and End too.
const grp = (...actions: ModelGroupRow['action'][]): ModelGroupRow[] => actions.map((action) => ({ label: String(action), value: '', action }));
const all = grp('dates', 'costing', 'runSheet', 'barPage', 'end');
assert.deepEqual(splitGroup(all, false, true).map((g) => g.map((r) => r.action)), [['dates', 'costing', 'barPage', 'end'], ['runSheet']]);
assert.deepEqual(splitGroup(all, true, true).map((g) => g.map((r) => r.action)), [['dates', 'costing'], ['runSheet', 'barPage', 'end']]);
assert.deepEqual(splitGroup(all, false, false)[1], []); // a creator's Run sheet stays where Menu-page draws it, until the list is living
assert.deepEqual(splitGroup(all, true, false)[1].map((r) => r.action), ['runSheet', 'barPage', 'end']);

console.log('liveList ok');
