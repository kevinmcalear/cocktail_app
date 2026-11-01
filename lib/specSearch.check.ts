// Checks and timings for lib/specSearch.ts. Run: npm run test:unit
// The budget (Quality bar B6): local results at or under 8 ms of JS per
// keystroke on a mid-range Android. Hermes there is 10 to 40 times slower
// than Node on a Mac, so Node must answer a 1,000-drink venue well under
// 0.2 ms at p50. On-device numbers: the /dev/search-bench screen.
import assert from 'node:assert/strict';

import { benchCorpus, runSearchBench } from './specSearchBench';
import { buildSearchIndex, rankHits, searchNames, searchNear, type SearchHit } from './specSearch';

const index = buildSearchIndex('b1', benchCorpus(1000));
const names = (hits: SearchHit[]) => hits.map((h) => h.item.name);
const top = (q: string, onNow?: Set<string>) => rankHits(searchNames(index, q), onNow);

// --- tier 1: names ---
assert.equal(top('negroni')[0].item.name, 'Negroni', 'the exact name first');
assert.equal(top('neg')[0].item.name, 'Negroni', 'then the name’s start, shortest first');
assert.equal(top('carre')[0].item.name, 'Vieux Carré', 'accents fold: carre finds Carré');
assert.equal(top('vieux carre')[0].tier, 1);
assert.equal(top('pina')[0].item.name, 'Piña Colada');
assert.equal(top('ti punch')[0].item.name, "Ti' Punch", 'punctuation is a space');
assert.ok(names(top('old fash')).includes('Oaxaca Old Fashioned'), 'every typed word starts a word of the name');
assert.ok(names(top('roni')).includes('Negroni'), 'anywhere in the name, last in tier 1');
assert.equal(top('roni').find((h) => h.item.name === 'Negroni')?.score, 3);

// --- tier 2: ingredients, tags, makers ---
const campari = top('campari');
assert.ok(campari.length > 10 && campari.every((h) => h.tier === 2 && h.score === 4), 'Campari is in the lines, not a name');
assert.ok(top('sweet ver').every((h) => h.item.recipes?.some((l) => /Sweet Vermouth/.test(l.ingredient?.name ?? ''))));
const stirred = searchNames(index, 'stirred');
assert.ok(stirred.length > 100 && stirred.every((h) => h.score === 5), 'a method is a tag');
assert.equal(top('stirred').length, 50, 'ranked hits stop at the limit');
assert.ok(top('house made').length > 0, 'a house-made is tagged so');
const carpano = searchNames(index, 'carpano');
assert.ok(carpano.some((h) => h.score === 6 && h.item.item_type === 'ingredient'), 'a maker');
assert.ok(carpano.some((h) => h.score === 4), 'and the drinks with the bottle');
assert.ok(top('negroni stirred').every((h) => h.item.name!.includes('Negroni')), 'words narrow across fields');
assert.ok(searchNames(index, 'n').every((h) => h.score <= 2), 'one letter: only the starts of names and their words');
assert.deepEqual(top('zzz'), []);
assert.deepEqual(top('  '), []);

// --- what's on a list now wins among equals ---
const negronis = top('negroni').filter((h) => h.score === 2);
const onNow = new Set([negronis.at(-1)!.item.id!]);
assert.equal(top('negroni', onNow).filter((h) => h.score === 2)[0].item.id, negronis.at(-1)!.item.id);

// --- narrowing as you type gives what a fresh search gives ---
const fresh = buildSearchIndex('b1', benchCorpus(1000));
for (const q of ['s', 'sw', 'swe', 'sweet', 'sweet v', 'sweet ve']) searchNames(index, q);
assert.deepEqual(names(rankHits(searchNames(index, 'sweet ver'))), names(rankHits(searchNames(fresh, 'sweet ver'))));
searchNames(index, 'gin');
assert.deepEqual(names(rankHits(searchNames(index, 'campari'))), names(rankHits(searchNames(fresh, 'campari'))), 'a new word starts over');

// --- tier 3: near misses ---
const typo = searchNear(index, 'negorni', new Set());
assert.ok(names(rankHits(typo)).includes('Negroni') && typo.every((h) => h.tier === 3 && h.score >= 10), 'Did you mean, after names and lines');
assert.deepEqual(searchNear(index, 'ng', new Set()), [], 'never under three letters');
const found = new Set(searchNames(index, 'jungle').map((h) => h.item.id!));
assert.ok(searchNear(index, 'jungle', found).every((h) => !found.has(h.item.id!)), 'not what the first tiers found');

// --- timings (Node on the machine running this) ---
const venue = runSearchBench(1000, () => performance.now());
const big = runSearchBench(3000, () => performance.now());
console.log('specSearch timings, ms', JSON.stringify({ venue, big }));
// Loose ceilings, about 10 times today's Mac numbers, so a slow CI runner doesn't fail;
// what they catch is a change that makes typing scan like a full-text engine.
assert.ok(venue.keystroke.p50 < 0.5, `1,000 drinks: p50 ${venue.keystroke.p50} ms per letter`);
assert.ok(venue.keystroke.p95 < 2, `1,000 drinks: p95 ${venue.keystroke.p95} ms per letter`);
assert.ok(venue.near.p95 < 20, `1,000 drinks: near misses p95 ${venue.near.p95} ms`);
assert.ok(venue.buildMs < 100, `1,000 drinks: index built in ${venue.buildMs} ms`);

console.log('specSearch checks passed');
