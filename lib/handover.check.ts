// Checks for lib/handover.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { isUnread, lastNote, lines, names, noteFor, ranOutChoices, readByLine, summary, type HandoverRow } from './handover';

const row = (o: Partial<HandoverRow>): HandoverRow => ({ close_date: '2026-10-30', user_id: 'ana', ran_out: [], note: null, prep: null, broken: null, written_at: null, read_at: null, ...o });
const rows: HandoverRow[] = [
  row({ user_id: 'theo', ran_out: ['Lemons'], note: 'Lemons nearly out.', written_at: '2026-10-31T01:40:00Z', read_at: '2026-10-31T01:40:00Z' }),
  row({ user_id: 'ana', ran_out: ['Grenadine', 'lemons'], note: 'Quiet after 11.', prep: 'Honey-ginger syrup, one batch', broken: 'Ice well drains slowly.\n\nTap 3, drips', written_at: '2026-10-31T01:24:00Z', read_at: '2026-10-31T01:24:00Z' }),
  row({ user_id: 'maya', read_at: '2026-10-31T16:00:00Z' }),
  row({ close_date: '2026-10-29', user_id: 'ana', note: 'Older', written_at: '2026-10-30T01:00:00Z' }),
  row({ close_date: '2026-10-31', user_id: 'me', read_at: null }),
];

const note = noteFor(rows, '2026-10-30')!;
assert.deepEqual(note.writers.map((w) => w.user_id), ['ana', 'theo'], 'writers in the order they wrote');
assert.deepEqual(note.ranOut, ['Grenadine', 'lemons'], 'one of each thing that ran out');
assert.deepEqual(note.prep, [{ name: 'Honey-ginger syrup', sub: 'One batch' }]);
assert.deepEqual(note.broken, [{ name: 'Ice well drains slowly.', sub: null }, { name: 'Tap 3', sub: 'Drips' }]);
assert.deepEqual(note.readers, ['maya'], 'readers are the people who read without writing');
assert.equal(noteFor(rows, '2026-10-31'), null, 'a close nobody wrote for has no note');

assert.equal(lastNote(rows, '2026-10-31')?.closeDate, '2026-10-30', 'the last close before tonight');
assert.equal(lastNote(rows, '2026-10-30')?.closeDate, '2026-10-29');
assert.equal(lastNote(rows, '2026-10-29'), null);

assert.equal(isUnread(note, rows, 'me'), true, 'on top until read');
assert.equal(isUnread(note, rows, 'maya'), false, 'gone once read');
assert.equal(isUnread(note, rows, 'theo'), false, 'a writer has read it');
assert.equal(isUnread(note, rows, null), false);

assert.equal(summary(note), 'Ran out of Grenadine and lemons. Honey-ginger syrup needs doing. Ice well drains slowly.');
assert.equal(summary(noteFor(rows, '2026-10-29')!), 'Older', 'with nothing listed, the note itself');

assert.deepEqual(lines(' A, b \n\n C '), [{ name: 'A', sub: 'B' }, { name: 'C', sub: null }]);
assert.equal(names(['Ana']), 'Ana');
assert.equal(names(['Ana', 'Theo', 'Maya']), 'Ana, Theo and Maya');

const nameOf = (id: string) => ({ theo: 'Theo Grant', maya: 'Maya Lee' })[id] ?? 'Someone';
assert.equal(readByLine(['theo', 'me', 'maya'], 'me', nameOf), 'Read by you, Theo and Maya');
assert.equal(readByLine([], 'me', nameOf), null);

assert.deepEqual(ranOutChoices(['Grenadine', 'Honey-ginger syrup'], ['grenadine', 'Lemons'], ['Large cubes']), ['Grenadine', 'Honey-ginger syrup', 'Lemons', 'Large cubes'], 'stable order, picked extras last');
assert.deepEqual(ranOutChoices(['A', 'B', 'C'], [], ['B'], 2), ['A', 'B']);
assert.deepEqual(ranOutChoices(['Lemons'], [], ['lemons']), ['lemons'], 'a picked spelling wins, so its chip shows picked');

console.log('handover checks passed');
