// Checks for lib/palate.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { DIMENSIONS, type Profile } from './flavor';
import { changeBetween, FAMILY, meet, labelSpot, outlinePath, palateByMonth, palateLabel, petalPath, pull, RINGS, shapedBy, tasteFromRankings, WHEEL, type RankedFlavor } from './palate';

const p = (values: Partial<Profile>): Profile => Object.fromEntries(DIMENSIONS.map((d) => [d, values[d] ?? 0])) as Profile;
const near = (a: number, b: number, msg?: string) => assert.ok(Math.abs(a - b) < 1e-9, msg ?? `${a} vs ${b}`);

// The average drink: a bit sweet and sour, strong like nearly every cocktail.
const base = p({ sweet: 0.4, sour: 0.3, bitter: 0.2, strong: 0.7, herbal: 0.15, fruity: 0.2, smoky: 0.05, creamy: 0.1 });
const mezcalNegroni = p({ sweet: 0.55, bitter: 0.9, strong: 0.8, herbal: 0.5, smoky: 0.85, fruity: 0.2 });
const colada = p({ sweet: 0.9, fruity: 0.95, sour: 0.4, creamy: 0.8, strong: 0.4 });
const daiquiri = p({ sweet: 0.75, sour: 0.8, strong: 0.6, fruity: 0.3 });
const same = (a: Profile, b: Profile, msg?: string) => DIMENSIONS.forEach((d) => near(a[d], b[d], `${msg ?? ''} ${d}: ${a[d]} vs ${b[d]}`));
const band = (score: number) => (score >= 6.7 ? 'loved' : score >= 3.4 ? 'fine' : 'disliked');
const had = (itemId: string, score: number, profile: Profile, createdAt = '2026-09-01T10:00:00Z'): RankedFlavor => ({ itemId, name: itemId, score, sentiment: band(score), createdAt, profile });

// Pull: by band. A lone disliked drink scores 3.3 and still pushes half as hard as a 10 pulls.
assert.equal(pull({ score: 10, sentiment: 'loved' }), 1);
assert.equal(pull({ score: 6.7, sentiment: 'loved' }), 0.5);
assert.equal(pull({ score: 5, sentiment: 'fine' }), 0);
near(pull({ score: 6.6, sentiment: 'fine' }), 0.3);
assert.equal(pull({ score: 3.3, sentiment: 'disliked' }), -0.5);
assert.equal(pull({ score: 0, sentiment: 'disliked' }), -1);

// One loved drink: your taste is that drink.
const one = tasteFromRankings([had('mn', 10, mezcalNegroni)], base)!;
same(one.taste, mezcalNegroni);
assert.equal(one.drinks, 1);
assert.equal(tasteFromRankings([], base), null);

// A disliked drink pushes away, and only where it stands out from the average.
const pushed = tasteFromRankings([had('mn', 10, mezcalNegroni), had('pc', 0, colada)], base)!.taste;
assert.ok(pushed.creamy < mezcalNegroni.creamy + 1e-9 && pushed.creamy === 0, 'creamy pushed to the floor');
assert.ok(pushed.fruity < base.fruity, 'fruity pushed below the average drink');
assert.ok(pushed.smoky > base.smoky, 'the loved drink still pulls smoky up');
// Before this, a disliked drink pulled you a little towards it: (score / 10)^2 weighting.
const oldWay = (mezcalNegroni.creamy * 1 + colada.creamy * 0.04) / 1.04;
assert.ok(pushed.creamy < oldWay, 'disliking a Piña Colada no longer makes you a little more creamy');
// The usual case: one loved, one disliked, each alone in its band (10 and 3.3).
const lone = tasteFromRankings([had('mn', 10, mezcalNegroni), had('pc', 3.3, colada)], base)!.taste;
assert.ok(lone.fruity < base.fruity && lone.creamy < base.creamy, 'a lone disliked drink still pushes');

// Disliking a strong drink says little about strong: it's no stronger than the average.
const strongDislike = tasteFromRankings([had('mn', 10, mezcalNegroni), had('x', 0, p({ ...base, strong: 0.7 }))], base)!.taste;
near(strongDislike.strong, base.strong + (mezcalNegroni.strong - base.strong) / 2, 'only the loved drink moves strong');

// A drink right in the middle moves nothing; all-middle leaves the average drink.
same(tasteFromRankings([had('d', 5, daiquiri)], base)!.taste, base);
// One entry per drink, at your best score (ranked at two bars).
assert.equal(tasteFromRankings([had('mn', 10, mezcalNegroni), had('mn', 2, mezcalNegroni)], base)!.drinks, 1);
// No baseline yet: your own drinks' average stands in.
assert.ok(tasteFromRankings([had('mn', 10, mezcalNegroni), had('pc', 0, colada)], null)!.taste.smoky > 0.4);

// What shaped it: strongest first, loved pulls, disliked pushes, the middle barely moves it.
const shaped = shapedBy([had('d', 5.2, daiquiri), had('pc', 2.1, colada), had('mn', 9.4, mezcalNegroni)], base);
assert.deepEqual(
  shaped.map((s) => [s.itemId, s.way, s.moved]),
  [
    ['mn', 'pull', ['smoky', 'bitter']],
    ['pc', 'push', ['fruity', 'creamy']],
    ['d', 'none', []],
  ]
);

// Pushes always get a place, even behind five 10s.
const many = [1, 2, 3, 4, 5, 6].map((n) => had(`l${n}`, 10, mezcalNegroni, `2026-09-0${n}T10:00:00Z`));
const kept = shapedBy([...many, had('pc', 3.3, colada)], base);
assert.deepEqual(kept.map((s) => s.way), ['pull', 'pull', 'pull', 'pull', 'push']);

// Over time: one palate per month, oldest first, answers blended as they were then.
const months = palateByMonth(
  [had('d', 9, daiquiri, '2026-07-03T10:00:00Z'), had('mn', 10, mezcalNegroni, '2026-09-12T10:00:00Z'), had('pc', 1, colada, '2026-09-20T10:00:00Z')],
  base,
  { sour: 0.8 }
);
assert.deepEqual(months.map((m) => m.key), ['2026-07', '2026-09']);
assert.ok(months[1].taste.smoky! > months[0].taste.smoky!, 'the mezcal moved it');
assert.equal(changeBetween(months[0].taste, months[1].taste), 'more bitter and smoky, less sweet');
assert.deepEqual(palateByMonth([had('d', 9, daiquiri)], base, null), [], 'one month has nothing to compare');
assert.equal(changeBetween(base, base), null);

// Where a drink meets you.
const smokyBitter = { ...p({}), bitter: 0.85, smoky: 0.7, strong: 0.8, sweet: 0.2, sour: 0.4 };
assert.deepEqual(meet(smokyBitter, mezcalNegroni, base), { shared: ['bitter', 'smoky'], more: 'herbal', less: 'sour' });
assert.deepEqual(meet({}, mezcalNegroni, base), { shared: [], more: null, less: null });

// The wheel: every taste once, three to a family, families in quarters.
assert.deepEqual([...WHEEL].sort(), [...DIMENSIONS].sort());
assert.deepEqual(WHEEL.map((d) => FAMILY[d]).join(','), 'bright,bright,bright,green,green,green,fire,fire,fire,body,body,body');
assert.ok(petalPath(0, 1).includes('100.0 14.0'), 'sweet at full reach tips at twelve o’clock');
assert.ok(petalPath(3, 1).includes('186.0 100.0'), 'botanical at three o’clock');
assert.equal(RINGS.length, 5);
assert.equal(outlinePath({}), WHEEL.map(() => '').join(' '));
assert.deepEqual(labelSpot(0).anchor, 'middle');
assert.deepEqual(labelSpot(3).anchor, 'start');
assert.deepEqual(labelSpot(9).anchor, 'end');
assert.equal(palateLabel({ bitter: 0.9, smoky: 0.5 }), 'Palate: bitter intensely, smoky fairly');
assert.equal(palateLabel({}), 'Palate: nothing yet');

console.log('lib/palate.check: ok');
