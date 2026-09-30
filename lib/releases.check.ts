import assert from 'node:assert/strict';

import { dayStart, releaseProblems, releaseStatus } from './releases';

const now = Date.parse('2026-10-01T12:00:00Z');
assert.equal(releaseStatus({ publishedAt: null, moderatedAt: null }, now), 'draft');
assert.equal(releaseStatus({ publishedAt: '2026-09-01T00:00:00Z', moderatedAt: null }, now), 'live');
assert.equal(releaseStatus({ publishedAt: '2026-12-01T00:00:00Z', moderatedAt: null }, now), 'scheduled');
assert.equal(releaseStatus({ publishedAt: '2026-09-01T00:00:00Z', moderatedAt: '2026-09-02T00:00:00Z' }, now), 'hidden');

assert.equal(dayStart('2026-12-01')?.getDate(), 1);
assert.equal(dayStart('2026-02-31'), null);
assert.equal(dayStart('1 March'), null);

assert.deepEqual(releaseProblems({ name: 'Autumn', releaseDate: '2026-12-01', drinks: [{ name: 'Bolo Tie', isPublic: true }] }), []);
assert.deepEqual(releaseProblems({ name: ' ', releaseDate: 'soon', drinks: [] }), [
  'Give it a name.',
  'Use a date like 2026-12-01.',
  'Add at least one drink.',
]);
assert.deepEqual(releaseProblems({ name: 'Autumn', releaseDate: '2026-12-01', drinks: [{ name: 'Bolo Tie', isPublic: false }] }), [
  'Publish Bolo Tie first, or take it out.',
]);

console.log('releases: ok');
