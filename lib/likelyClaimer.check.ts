import assert from 'node:assert/strict';

import { nameKey, namesMatch, readSetupAnswer, viewerNameKeys, worksInBars } from './likelyClaimer';

assert.equal(nameKey('  José  O’Neil '), 'jose o neil');
assert.equal(nameKey('ASH OKAFOR'), 'ash okafor');

// Profile name and setup's full name, deduped; one-word names left out.
assert.deepEqual(viewerNameKeys({ full_name: 'Ash Okafor' }, 'Ash Okafor'), ['ash okafor']);
assert.deepEqual(viewerNameKeys({ first_name: 'Sam' }, 'Sam'), []);
assert.deepEqual(viewerNameKeys({ first_name: 'Jo', last_name: 'Marsh' }, null), ['jo marsh']);
assert.deepEqual(viewerNameKeys(null, undefined), []);

assert.equal(namesMatch(viewerNameKeys({ full_name: 'Ash Okafor' }, null), ['Jo Marsh', 'ash okafor']), true);
assert.equal(namesMatch(viewerNameKeys({ full_name: 'Kevin McAlear' }, null), ['Jo Marsh', 'Ash Okafor']), false);
assert.equal(namesMatch([], ['Ash Okafor']), false);

// Short first names and slips find the page: Matt and Mathew Resler, Reisler for Resler, Sam and Samantha, Jo and Joe.
assert.equal(namesMatch(viewerNameKeys({ full_name: 'Matt Resler' }, null), ['Mathew Resler']), true);
assert.equal(namesMatch(viewerNameKeys({ full_name: 'Mat Resler' }, null), ['Matthew Resler']), true);
assert.equal(namesMatch(viewerNameKeys({ full_name: 'Sam Ortiz' }, null), ['Samantha Ortiz']), true);
assert.equal(namesMatch(viewerNameKeys({ full_name: 'Jo Marsh' }, null), ['Joe Marsh']), true);
assert.equal(namesMatch(viewerNameKeys({ full_name: 'Matt Reisler' }, null), ['Mathew Resler']), true);
// A different first name or last name doesn't.
assert.equal(namesMatch(viewerNameKeys({ full_name: 'Mark Resler' }, null), ['Mathew Resler']), false);
assert.equal(namesMatch(viewerNameKeys({ full_name: 'Matt Jones' }, null), ['Mathew Resler']), false);

assert.equal(readSetupAnswer({ setup_answer: 'owner' }), 'owner');
assert.equal(readSetupAnswer({ setup_answer: 'boss' }), null);
assert.equal(readSetupAnswer(undefined), null);
assert.equal(worksInBars('bartender'), true);
assert.equal(worksInBars('drinks'), false);
assert.equal(worksInBars(null), false);

console.log('likelyClaimer checks passed');
