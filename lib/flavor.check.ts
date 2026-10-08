import assert from 'node:assert/strict';

import {
  answerShare,
  blendTaste,
  COLD_START_DRINKS,
  DIMENSIONS,
  distance,
  forYou,
  level,
  matchPercent,
  matchReasons,
  meanProfile,
  mostCreative,
  QUESTIONS,
  QUICK_QUESTIONS,
  rankingsDrift,
  tasteHeadline,
  tasteSource,
  type FlavorDrink,
  type Profile,
} from './flavor';

const p = (values: Partial<Profile>): Profile => Object.fromEntries(DIMENSIONS.map((d) => [d, values[d] ?? 0])) as Profile;

const negroni = p({ bitter: 0.95, strong: 0.8, herbal: 0.7, sweet: 0.6 });
const daiquiri = p({ sour: 0.8, sweet: 0.8, strong: 0.65, fruity: 0.25 });
const boulevardier = p({ bitter: 0.9, strong: 0.85, sweet: 0.6, herbal: 0.5 });
const colada = p({ fruity: 1, sweet: 0.95, sour: 0.55, creamy: 0.45 });

// Match: identical is 100, closer is higher, empty taste says nothing.
assert.equal(matchPercent(negroni, negroni), 100);
assert.ok(matchPercent(negroni, boulevardier)! > matchPercent(negroni, daiquiri)!);
assert.ok(matchPercent(negroni, colada)! < 50, 'a Negroni lover and a Piña Colada are far apart');
assert.equal(matchPercent({}, negroni), null);
assert.equal(distance({ bitter: 0.9 }, negroni), Math.abs(0.9 - 0.95), 'partial tastes compare only what they have');

// Reasons: shared highs first, then what's well past your usual.
assert.equal(matchReasons(negroni, boulevardier, 'ranked'), 'Bitter and strong, like the drinks you rank highest.');
assert.equal(matchReasons(negroni, colada, 'ranked'), 'Sweet, like the drinks you rank highest, but more fruity than usual.');
assert.equal(matchReasons({ bitter: 0.1, sour: 0.1 }, daiquiri, 'answers'), 'More sour than you usually go for.');
assert.equal(matchReasons({ bitter: 0.8 }, boulevardier, 'answers'), 'Bitter, as you said you like.');
assert.equal(matchReasons({ smoky: 0.1 }, negroni, 'ranked'), 'Nothing far from what you usually enjoy.');
assert.equal(matchReasons({ bitter: 0.8 }, daiquiri, 'answers'), 'Less bitter than you usually go for.');
// A dimension both share is never also "more than usual".
assert.equal(matchReasons({ herbal: 0.4, strong: 0.9 }, p({ herbal: 1, strong: 1 }), 'ranked'), 'Strong and herbal, like the drinks you rank highest.');
// Against a baseline, what's distinctive leads and what every drink has drops out.
const usual = meanProfile([negroni, daiquiri, colada, boulevardier])!;
assert.equal(matchReasons(negroni, boulevardier, 'ranked', usual), 'Bitter and strong, like the drinks you rank highest.');
assert.equal(matchReasons({ strong: 0.5, sour: 0.8 }, daiquiri, 'ranked', usual), 'Sour, like the drinks you rank highest.');
assert.equal(meanProfile([]), null);

// Answers start your taste and count for less with every drink you rank, but never drop out.
assert.deepEqual(blendTaste(null, 0, { sour: 0.8 }), { taste: { sour: 0.8 }, basis: 'answers' });
assert.deepEqual(blendTaste(null, 0, null), { taste: {}, basis: 'ranked' });
assert.deepEqual(blendTaste(negroni, 7, null), { taste: negroni, basis: 'ranked' });
assert.deepEqual(blendTaste(negroni, 7, {}), { taste: negroni, basis: 'ranked' }, 'cleared answers are no answers');
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const two = blendTaste(p({ sour: 0.2 }), 2, { sour: 0.8 });
assert.equal(two.basis, 'answers');
assert.ok(near(two.taste.sour!, 0.8 * (5 / 7) + 0.2 * (2 / 7)));
assert.equal(two.taste.bitter, 0, 'a dimension you did not answer comes from your rankings');
const five = blendTaste(negroni, COLD_START_DRINKS, { bitter: 0.1 });
assert.equal(five.basis, 'ranked', 'enough rankings for a match percentage');
assert.ok(near(five.taste.bitter!, (0.95 + 0.1) / 2), 'at five rankings your answers are still half');
assert.ok(near(answerShare(20), 0.2) && answerShare(100) < 0.05, 'and fade as you rank more');
const changed = blendTaste(negroni, 40, { bitter: 0.1 });
assert.ok(changed.taste.bitter! < negroni.bitter, 'changing an answer still moves a well-ranked taste');

assert.equal(rankingsDrift(negroni, { bitter: 0.1, sour: 0.8, smoky: 0.1 }), 'Your rankings lean more bitter and less sour than you said.');
assert.equal(rankingsDrift(p({ smoky: 0.9 }), { smoky: 0.1, bitter: 0.45 }), 'Your rankings lean more smoky and less bitter than you said.');
assert.equal(rankingsDrift(negroni, { bitter: 0.8 }), null, 'close enough says nothing');
assert.equal(rankingsDrift(null, { bitter: 0.8 }), null);

assert.equal(QUESTIONS.length, DIMENSIONS.length);
assert.deepEqual(new Set(QUESTIONS.map((q) => q.dim)), new Set(DIMENSIONS), 'one question per dimension');
assert.equal(QUICK_QUESTIONS.length, 6);
assert.equal(tasteHeadline(negroni), 'Bitter, herbal and sweet');
assert.equal(tasteHeadline({ strong: 0.9 }), null, 'strong alone says nothing');
assert.equal(tasteHeadline({ smoky: 0.2 }), null);
assert.equal(tasteSource(0, true), 'From your answers. Every drink you rank moves it.');
assert.equal(tasteSource(1, false), "From the 1 drink you've ranked, the ones you score highest counting most.");
assert.equal(tasteSource(20, true), "From your answers and the 20 drinks you've ranked. Your rankings are 80% of it now, and count for more with every drink you rank.");

const drink = (id: string, profile: Profile, extra: Partial<FlavorDrink> = {}): FlavorDrink => ({
  id,
  name: id,
  imageUrl: null,
  isClassic: false,
  riffOfId: null,
  profile,
  ...extra,
});

// For you: best fit first, ranked drinks left out, no percentage in the cold start.
const menu = [drink('Negroni', negroni), drink('Daiquiri', daiquiri), drink('Boulevardier', boulevardier), drink('Colada', colada)];
const picks = forYou(menu, negroni, 'ranked', ['Negroni']);
assert.deepEqual(picks.map((x) => x.id), ['Boulevardier', 'Daiquiri', 'Colada']);
assert.ok(picks[0].match! > 80 && picks[0].reason.startsWith('Bitter and strong'));
assert.equal(forYou(menu, { bitter: 0.8 }, 'answers', [])[0].match, null);
assert.deepEqual(forYou(menu, {}, 'ranked', []), []);

// Most creative: well-ranked drinks furthest from their classic; classics and low scores left out.
const classics = [drink('Negroni', negroni, { isClassic: true }), drink('Daiquiri', daiquiri, { isClassic: true })];
const riffs = [
  drink('Smoky Negroni', p({ bitter: 0.9, strong: 0.8, smoky: 0.9, sweet: 0.5 }), { riffOfId: 'Negroni' }),
  drink('Close Negroni', p({ bitter: 0.9, strong: 0.8, herbal: 0.7, sweet: 0.6 }), { riffOfId: 'Negroni' }),
  drink('Creamy Daiq', colada),
  drink('Unloved', p({ spicy: 1 })),
];
const scores = { 'Smoky Negroni': 8.4, 'Close Negroni': 9.1, 'Creamy Daiq': 7.2, Unloved: 5, Negroni: 9.5 };
const creative = mostCreative([...classics, ...riffs], scores);
assert.deepEqual(creative.map((c) => c.id), ['Smoky Negroni', 'Creamy Daiq', 'Close Negroni']);
assert.deepEqual([creative[0].from, creative[0].versionOf], ['Negroni', true]);
assert.deepEqual([creative[1].from, creative[1].versionOf], ['Daiquiri', false], 'nearest classic when it is not a version of one');
assert.deepEqual(mostCreative(riffs, scores), [], 'no classics, nothing to measure against');

assert.equal(level(0.05), 'barely');
assert.equal(level(0.9), 'intensely');

console.log('lib/flavor.check: ok');
