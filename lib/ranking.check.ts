// Checks for lib/ranking.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { comparedWith, dayOf, formatScore, localDate, nextPlacement, plural, rankedAs, rankKeyAt, rankScore, type Answer, type Sentiment } from './ranking';

// --- Scores match private.rank_score ---
// Every (sentiment, count 1..7, index) from the local stack:
//   select s, c, i, private.rank_score(s::rank_sentiment, i, c) ...
const FROM_POSTGRES =
  'd,1,0,3.3;d,2,0,3.3;d,2,1,1.7;d,3,0,3.3;d,3,1,2.2;d,3,2,1.1;d,4,0,3.3;d,4,1,2.5;d,4,2,1.7;d,4,3,0.8;d,5,0,3.3;d,5,1,2.6;d,5,2,2.0;d,5,3,1.3;d,5,4,0.7;d,6,0,3.3;d,6,1,2.8;d,6,2,2.2;d,6,3,1.7;d,6,4,1.1;d,6,5,0.6;d,7,0,3.3;d,7,1,2.8;d,7,2,2.4;d,7,3,1.9;d,7,4,1.4;d,7,5,0.9;d,7,6,0.5;' +
  'f,1,0,6.6;f,2,0,6.6;f,2,1,5.0;f,3,0,6.6;f,3,1,5.5;f,3,2,4.5;f,4,0,6.6;f,4,1,5.8;f,4,2,5.0;f,4,3,4.2;f,5,0,6.6;f,5,1,6.0;f,5,2,5.3;f,5,3,4.7;f,5,4,4.0;f,6,0,6.6;f,6,1,6.1;f,6,2,5.5;f,6,3,5.0;f,6,4,4.5;f,6,5,3.9;f,7,0,6.6;f,7,1,6.1;f,7,2,5.7;f,7,3,5.2;f,7,4,4.8;f,7,5,4.3;f,7,6,3.9;' +
  'l,1,0,10.0;l,2,0,10.0;l,2,1,8.4;l,3,0,10.0;l,3,1,8.9;l,3,2,7.8;l,4,0,10.0;l,4,1,9.2;l,4,2,8.4;l,4,3,7.5;l,5,0,10.0;l,5,1,9.3;l,5,2,8.7;l,5,3,8.0;l,5,4,7.4;l,6,0,10.0;l,6,1,9.5;l,6,2,8.9;l,6,3,8.4;l,6,4,7.8;l,6,5,7.3;l,7,0,10.0;l,7,1,9.5;l,7,2,9.1;l,7,3,8.6;l,7,4,8.1;l,7,5,7.6;l,7,6,7.2';
const LETTER: Record<string, Sentiment> = { l: 'loved', f: 'fine', d: 'disliked' };
for (const row of FROM_POSTGRES.split(';')) {
  const [s, count, index, score] = row.split(',');
  assert.equal(rankScore(LETTER[s], Number(index), Number(count)), Number(score), `rank_score(${LETTER[s]}, ${index}, ${count})`);
}
// Larger lists and a count of 0 (greatest(count, 1) in SQL), also from Postgres.
assert.equal(rankScore('loved', 0, 0), 10);
assert.equal(rankScore('loved', 1, 20), 9.8);
assert.equal(rankScore('fine', 3, 40), 6.4);

// Bands never overlap, and the best of a lower band is below the worst of a higher one.
for (let count = 1; count <= 60; count++) {
  assert.ok(rankScore('loved', count - 1, count) >= 6.7);
  assert.ok(rankScore('fine', 0, count) <= 6.6 && rankScore('fine', count - 1, count) >= 3.4);
  assert.ok(rankScore('disliked', 0, count) <= 3.3 && rankScore('disliked', count - 1, count) >= 0);
}
assert.equal(formatScore(10), '10.0');
assert.equal(formatScore(8.4), '8.4');

// --- Binary insertion ---
// Place a drink whose true position is `truth` among `count` entries, answering honestly.
function place(count: number, truth: number): { index: number; asked: number } {
  const answers: Answer[] = [];
  for (;;) {
    const p = nextPlacement(count, answers);
    if (p.done) return { index: p.index, asked: answers.length };
    assert.ok(p.against >= 0 && p.against < count);
    assert.ok(p.remaining >= 1);
    answers.push(truth <= p.against ? 'new' : 'old');
  }
}
for (let count = 0; count <= 40; count++) {
  for (let truth = 0; truth <= count; truth++) {
    const { index, asked } = place(count, truth);
    assert.equal(index, truth, `count ${count}, truth ${truth}`);
    assert.ok(asked <= Math.ceil(Math.log2(count + 1)), `count ${count}: ${asked} questions`);
  }
}
assert.deepEqual(nextPlacement(0, []), { done: true, index: 0 });
assert.deepEqual(nextPlacement(5, []), { done: false, against: 2, remaining: 3 });
// Too close to call: straight after the one it was compared with.
assert.deepEqual(nextPlacement(5, ['tie']), { done: true, index: 3 });
assert.deepEqual(nextPlacement(5, ['new', 'tie']), { done: true, index: 2 });
// The "N more to place it" count only goes down.
{
  let last = Infinity;
  const answers: Answer[] = [];
  for (;;) {
    const p = nextPlacement(100, answers);
    if (p.done) break;
    assert.ok(p.remaining < last || (last === Infinity && p.remaining === 7));
    last = p.remaining;
    answers.push('old');
  }
}

// Which entries the answers were about, for rank_comparisons.
assert.deepEqual(comparedWith(5, ['old', 'new', 'tie']), [2, 4, 3]);
assert.deepEqual(comparedWith(0, []), []);

// --- rank_key ---
assert.equal(rankKeyAt([], 0), 0);
assert.equal(rankKeyAt([0, 1, 2], 0), -1);
assert.equal(rankKeyAt([0, 1, 2], 3), 3);
assert.equal(rankKeyAt([0, 1, 2], 1), 0.5);
// Repeated inserts into the same gap keep the order until precision runs out,
// then share the better neighbour's key (created_at breaks the tie).
{
  const keys = [0, 1];
  for (let i = 0; i < 60; i++) {
    const k = rankKeyAt(keys, 1);
    assert.ok(k >= keys[0] && k < keys[1]);
    keys.splice(1, 0, k);
    keys.splice(2);
  }
}

// --- Which list ---
assert.deepEqual(rankedAs({ id: 'house', name: 'House Martini', origin: 'Classic', riff_of_id: 'martini', riff_of: { id: 'martini', name: 'Martini' } }), { id: 'martini', name: 'Martini' });
assert.deepEqual(rankedAs({ id: 'riff', name: 'Smoky Martini', origin: 'Varient', riff_of_id: 'martini' }), { id: 'riff', name: 'Smoky Martini' });
assert.deepEqual(rankedAs({ id: 'original', name: 'Bolo Tie', origin: 'Original', riff_of_id: null }), { id: 'original', name: 'Bolo Tie' });
assert.deepEqual(rankedAs({ id: 'martini', name: 'Martini', origin: 'Classic', riff_of_id: null }), { id: 'martini', name: 'Martini' });

assert.equal(plural('Martini'), 'Martinis');
assert.equal(plural("Bee's Knees"), "Bee's Knees");

assert.equal(dayOf('2026-06-01').getMonth(), 5);
assert.equal(localDate(dayOf('2026-06-01')), '2026-06-01');
assert.equal(localDate(new Date(2026, 8, 6, 23, 30)), '2026-09-06');

console.log('ranking: ok');
