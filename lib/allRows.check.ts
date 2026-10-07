import assert from 'node:assert/strict';
import { allRows, PAGE_ROWS } from './allRows';

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

  console.log('allRows.check: ok');
})();
