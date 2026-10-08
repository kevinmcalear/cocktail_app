import assert from 'node:assert/strict';
import { allRows, allRowsById, byName, PAGE_ROWS, withRow } from './allRows';

// A fake PostgREST: 2,500 rows, at most PAGE_ROWS per request.
const table = Array.from({ length: 2500 }, (_, i) => i);
const calls: [number, number][] = [];
const fake = async (from: number, to: number) => {
  calls.push([from, to]);
  return { data: table.slice(from, Math.min(to + 1, from + PAGE_ROWS)), error: null };
};

(async () => {
  assert.deepEqual(await allRows(fake), table);
  assert.deepEqual(calls, [[0, 999], [1000, 1999], [2000, 2999]]);

  // Exactly a page asks once more, gets nothing, and stops.
  calls.length = 0;
  const one = Array.from({ length: PAGE_ROWS }, (_, i) => i);
  assert.equal((await allRows(async (from, to) => ({ data: one.slice(from, to + 1), error: null }))).length, PAGE_ROWS);

  // An error on any page throws rather than returning a short list.
  const boom = new Error('boom');
  await assert.rejects(allRows(async (from) => (from === 0 ? { data: one, error: null } : { data: null, error: boom })), boom);

  // Keyset: each page asks for the rows after the last id it has.
  const keyed = Array.from({ length: 2500 }, (_, i) => ({ id: `id-${String(i).padStart(5, '0')}` }));
  const afters: (string | null)[] = [];
  const byId = async (after: string | null, size: number) => {
    afters.push(after);
    return { data: keyed.filter((r) => after === null || r.id > after).slice(0, size), error: null };
  };
  assert.deepEqual(await allRowsById(byId), keyed);
  assert.deepEqual(afters, [null, 'id-00999', 'id-01999']);
  await assert.rejects(allRowsById(async (after) => (after ? { data: null, error: boom } : { data: keyed.slice(0, PAGE_ROWS), error: null })), boom);

  // Device order: by name, then id for equal names.
  const named = [{ id: 'b', name: 'Gin' }, { id: 'a', name: 'Gin' }, { id: 'c', name: 'Amaro' }, { id: 'd', name: null }];
  assert.deepEqual([...named].sort(byName).map((r) => r.id), ['d', 'c', 'a', 'b']);

  // withRow: a new row lands in name order, a renamed one moves, null removes.
  const list = [{ id: '1', name: 'Amaro' }, { id: '2', name: 'Gin' }, { id: '3', name: 'Rum' }];
  assert.deepEqual(withRow(list, '4', { id: '4', name: 'Mezcal' }).map((r) => r.id), ['1', '2', '4', '3']);
  assert.deepEqual(withRow(list, '1', { id: '1', name: 'Vodka' }).map((r) => r.id), ['2', '3', '1']);
  assert.deepEqual(withRow(list, '2', null).map((r) => r.id), ['1', '3']);
  assert.deepEqual(withRow(list, '9', { id: '9', name: 'Absinthe' }).map((r) => r.id), ['9', '1', '2', '3']);

  console.log('allRows.check: ok');
})();
