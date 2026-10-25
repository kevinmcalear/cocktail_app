// Checks for lib/myBarText.ts (My Bar's tile, row and card lines). Run: npm run test:unit
import assert from 'node:assert/strict';

import { barSubtitle, footLine, foundLine, groupLine, keepsFor, lastedLine, needsLine, pairName, prepMeta, shelfCountsLine, sourceCaption, prepUseBy, shortBottle, tickNames, usesLine } from './myBarText';

assert.equal(barSubtitle(7, 2), '7 drinks ready · 2 house-made ingredients you can make now');
assert.equal(barSubtitle(1, 0), '1 drink ready');
assert.equal(barSubtitle(0, 1), 'Nothing ready yet · 1 house-made ingredient you can make now');

assert.equal(shelfCountsLine({ bottles: 4, fridge: 6, lab: 2, preps: 2, kit: 3 }), '4 bottles · 6 in the fridge · 2 on the lab shelf · 2 house-made · 3 pieces of kit');
assert.equal(shelfCountsLine({ bottles: 1, fridge: 0, lab: 0, preps: 1, kit: 1 }), '1 bottle · 1 house-made · 1 piece of kit');

assert.equal(keepsFor(24 * 14), '2 weeks');
assert.equal(keepsFor(24 * 7), 'about a week');
assert.equal(keepsFor(24 * 90), '3 months');
assert.equal(keepsFor(24), 'a day');
assert.equal(keepsFor(6), '6 hours');
assert.equal(keepsFor(24 * 3), '3 days');

const now = new Date(2026, 9, 11, 12);
// Made yesterday, keeps two weeks: fresh.
assert.deepEqual(prepUseBy(new Date(2026, 9, 10, 12).toISOString(), 24 * 14, now), { text: 'keeps 2 weeks', soon: false });
// Made 3 Oct, keeps 10 days: use by 13 Oct, two days left.
assert.deepEqual(prepUseBy(new Date(2026, 9, 3, 12).toISOString(), 24 * 10, now), { text: 'use by 13 Oct', soon: true });
assert.deepEqual(prepUseBy(new Date(2026, 8, 1).toISOString(), 24 * 7, now), { text: 'past its use-by', soon: true });
assert.equal(prepUseBy(null, 24, now), null);
assert.equal(prepUseBy(new Date().toISOString(), null, now), null);

assert.equal(prepMeta('Overnight', 24 * 7), 'Overnight · keeps about a week');
assert.equal(prepMeta('5 min', null), '5 min');
assert.equal(prepMeta(null, null), null);

assert.equal(usesLine(['Woodford Reserve', 'Campari']), 'Uses your Woodford Reserve, Campari');
assert.equal(usesLine([]), 'Nothing else needed');
assert.equal(groupLine(6, ['Campari', 'Fernet-Branca']), 'Opens 6 drinks · uses your Campari, Fernet-Branca');
assert.equal(groupLine(1, ['Woodford Reserve']), 'Opens 1 drink · uses your Woodford Reserve');
assert.equal(groupLine(4, []), 'Opens 4 drinks · with your pantry');
assert.equal(groupLine(3, ['A', 'B', 'C']), 'Opens 3 drinks · uses your A, B +1');

assert.equal(pairName(['Gin', 'Sweet Vermouth']), 'Gin and Sweet Vermouth');
assert.equal(pairName(['Gin']), 'Gin');
assert.equal(needsLine(['Rye Whiskey', 'Absinthe']), 'Needs rye whiskey and absinthe');

assert.equal(sourceCaption(null, 'Served at Little Rye, Dante +4'), 'Classic · served at Little Rye, Dante +4');
assert.equal(sourceCaption(null, null), 'Classic');
assert.equal(sourceCaption('Little Rye', null), 'Little Rye');

assert.equal(footLine('ready'), 'Only drinks with a full spec you can follow.');
assert.match(footLine('one'), /^That’s everything your shelf gets close to\./);

assert.deepEqual(lastedLine(new Date(2026, 2, 2).toISOString(), new Date(2026, 7, 14).toISOString()), { bought: 'Bought 2 Mar', lasted: '5 mo' });
assert.deepEqual(lastedLine(new Date(2025, 8, 1).toISOString(), new Date(2026, 0, 20).toISOString()), { bought: 'Bought 1 Sept 2025', lasted: '5 mo' });
assert.deepEqual(lastedLine(null, new Date().toISOString()), { bought: null, lasted: null });

assert.equal(foundLine({ section: 'bottles', kind: 'Liqueur', origin: 'Sicily, Italy' }), 'Liqueur · Italy');
assert.equal(foundLine({ section: 'bottles', kind: 'London Dry Gin', origin: null }), 'London Dry Gin');
assert.equal(foundLine({ section: 'fridge', kind: null, origin: null }), 'Fridge & pantry');
assert.equal(foundLine({ section: 'preps', kind: 'Syrup', origin: null }), 'House-made');

console.log('myBarText checks passed');

// One name per thing: the bottle, not also its kind; lemon, not also lemon juice.
assert.deepEqual(
  tickNames([
    { name: 'Campari', generic: false, kind: 'Bitter Liqueur' },
    { name: 'Cocchi Storico Vermouth di Torino', generic: false, kind: 'Sweet Vermouth' },
    { name: 'Sweet Vermouth', generic: true },
    { name: 'Lemon', generic: true },
    { name: 'Lemon Juice', generic: true },
  ]),
  ['Campari', 'Cocchi Storico Vermouth di Torino', 'lemon'],
);
assert.deepEqual(tickNames([{ name: 'Gin', generic: true }]), ['gin']);
// Bottles go by their short name, as the board ticks them ("Woodford, lemon").
assert.deepEqual(
  tickNames([
    { name: 'Woodford Reserve Double Oaked', generic: false, kind: 'Bourbon', maker: 'Woodford Reserve' },
    { name: 'Bourbon', generic: true },
    { name: 'Cocchi Storico Vermouth di Torino', generic: false, maker: 'Cocchi' },
    { name: 'Lemon Juice', generic: true },
  ]),
  ['Woodford', 'Cocchi', 'lemon juice'],
);
assert.equal(shortBottle('Mr Black Cold Brew Coffee Liqueur', 'Mr Black'), 'Mr Black');
assert.equal(shortBottle('Ketel One Vodka', 'Ketel One'), 'Ketel One');
assert.equal(shortBottle('Amaro Nonino Quintessentia', 'Nonino'), 'Nonino');
assert.equal(shortBottle('Fernet-Branca', 'Fratelli Branca'), 'Fernet-Branca');
assert.equal(shortBottle('Campari', null), 'Campari');
