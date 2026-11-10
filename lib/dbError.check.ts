import assert from 'node:assert/strict';

import { saveErrorWords } from './dbError';

// The raw error goes to the console (Sentry in the app): kept out of this script's output.
console.error = () => {};

// The walk's cold shrub: a constraint's name never reaches the person.
const shrub = saveErrorWords({ code: '23514', message: 'new row for relation "item_steps" violates check constraint "item_steps_timer_seconds_check"' });
assert.doesNotMatch(shrub, /constraint|item_steps|violates/);
assert.match(shrub, /out of range/);

// Words the database wrote for people are said as they are.
assert.equal(saveErrorWords({ code: 'P0001', message: 'That name has a word we don’t allow. Please change it.' }), 'That name has a word we don’t allow. Please change it.');

// No signal, a name used twice, a row the venue's rules refuse, anything else: a sentence each, no SQL.
assert.match(saveErrorWords(new TypeError('Network request failed')), /reach the server/);
assert.match(saveErrorWords({ code: '23505', message: 'duplicate key value violates unique constraint "items_bar_name_key"' }), /already saved/);
assert.match(saveErrorWords({ code: '42501', message: 'new row violates row-level security policy for table "items"' }), /can’t add that here/);
for (const raw of [new Error('relation "x" does not exist'), { code: '42P01', message: 'relation "x" does not exist' }, null, 'boom']) {
  assert.equal(saveErrorWords(raw), 'Something went wrong saving it. Try again.');
}
