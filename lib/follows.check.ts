// Checks for lib/follows.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { dotLine, familyName, favouriteFamily, familyPlural, followLabel, friendRankLines, isThisWeek, namesLine, rankWhen, withArticle } from './follows';

// The button: Following wins, then Follow back when they follow you.
assert.equal(followLabel({ following: false, followsYou: false }), 'Follow');
assert.equal(followLabel({ following: false, followsYou: true }), 'Follow back');
assert.equal(followLabel({ following: true, followsYou: true }), 'Following');

// When: a night runs to 6am, then yesterday, the weekday, the date.
const sat = new Date(2026, 9, 31, 22, 0); // Saturday 31 October, 10pm
assert.equal(rankWhen(new Date(2026, 9, 31, 19, 0).toISOString(), sat, 'en-GB'), 'tonight');
assert.equal(rankWhen(new Date(2026, 10, 1, 1, 30).toISOString(), new Date(2026, 10, 1, 2, 0), 'en-GB'), 'tonight', '1:30am is still the night before');
assert.equal(rankWhen(new Date(2026, 9, 31, 9, 0).toISOString(), sat, 'en-GB'), 'today', 'the morning is today, not tonight');
assert.equal(rankWhen(new Date(2026, 9, 30, 21, 0).toISOString(), sat, 'en-GB'), 'yesterday');
assert.equal(rankWhen(new Date(2026, 9, 28, 21, 0).toISOString(), sat, 'en-GB'), 'Wednesday');
assert.equal(rankWhen(new Date(2026, 9, 12, 21, 0).toISOString(), sat, 'en-GB'), '12 Oct');
assert.equal(isThisWeek(new Date(2026, 9, 26, 21, 0).toISOString(), sat), true);
assert.equal(isThisWeek(new Date(2026, 9, 20, 21, 0).toISOString(), sat), false);

// Friends lines as drawn: the bar, then best or when.
assert.equal(withArticle('Old Fashioned'), 'an Old Fashioned');
const rank = { displayName: 'Sam Whitlock', name: 'Penicillin', venueName: 'Caretaker’s', createdAt: new Date(2026, 9, 31, 20).toISOString(), drinkFamily: 'Sour', bestInFamily: true };
assert.deepEqual(friendRankLines(rank, sat, 'en-GB'), { title: 'Sam ranked a Penicillin', sub: 'Caretaker’s · now Sam’s best sour' });
assert.deepEqual(friendRankLines({ ...rank, venueName: null }, sat, 'en-GB').sub, 'Now Sam’s best sour', 'no bar: the line starts with a capital');
assert.deepEqual(friendRankLines({ ...rank, name: 'Last Word', venueName: 'Night Owl', bestInFamily: false, createdAt: new Date(2026, 9, 29, 21).toISOString() }, sat, 'en-GB'), {
  title: 'Sam ranked a Last Word',
  sub: 'Night Owl · Thursday',
});

assert.equal(dotLine([null, 'now Sam’s best sour', 'tonight']), 'Now Sam’s best sour · tonight');

// Favourite: the family most ranks belong to, only with a clear lead.
assert.equal(favouriteFamily(['Sour', 'Sour', 'Martini', null]), 'Sour');
assert.equal(favouriteFamily(['Sour', 'Martini']), null, 'one each is no favourite');
assert.equal(favouriteFamily(['Sour', 'Sour', 'Martini', 'Martini']), null, 'a tie is no favourite');
assert.equal(familyPlural('Sour'), 'Sours');
assert.equal(familyPlural('Old Fashioned'), 'Old Fashioneds');
assert.equal(familyPlural('Tiki'), 'Tiki');
assert.equal(familyPlural('Fizz'), 'Fizzes');
assert.equal(familyPlural('Punch'), 'Punches');
assert.equal(familyName('sours'), 'Sour', 'one name, whatever the row says');
assert.equal(familyName('Old fashioned'), 'Old Fashioned');
assert.equal(familyName('fizz'), 'Fizz', 'outside the eight: capitalised as it is');
assert.equal(familyName('  '), null);

// The week is seven nights, the same ones rankWhen names by weekday: never a bare date.
const sun1am = new Date(2026, 10, 1, 1, 0).toISOString(); // the night of Saturday 31 October
assert.equal(isThisWeek(sun1am, new Date(2026, 10, 7, 22, 0)), false);
assert.equal(rankWhen(sun1am, new Date(2026, 10, 7, 22, 0), 'en-GB'), '31 Oct');
assert.equal(isThisWeek(sun1am, new Date(2026, 10, 6, 22, 0)), true);
assert.equal(rankWhen(sun1am, new Date(2026, 10, 6, 22, 0), 'en-GB'), 'Saturday');

// You's Following row.
assert.equal(namesLine(['Sam Whitlock', 'Ana Ruiz'], 14), 'Sam, Ana and 12 more');
assert.equal(namesLine(['Sam Whitlock', 'Ana Ruiz'], 2), 'Sam and Ana');
assert.equal(namesLine(['Sam Whitlock'], 1), 'Sam');
assert.equal(namesLine([], 3), null);

console.log('follows: ok');
