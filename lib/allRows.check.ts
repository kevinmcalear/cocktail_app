import assert from 'node:assert/strict';
import { allRows, allRowsById, PAGE_ROWS } from './allRows';

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

  console.log('allRows.check: ok');
})();
