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
// The app's own words (a plain Error it threw) are said; anything else gets a sentence, never its text.
assert.equal(saveErrorWords(new Error('Sign in to save drinks.')), 'Sign in to save drinks.');
const raw = [
  { code: '42P01', message: 'relation "x" does not exist' },
  { code: '23503', message: 'insert or update on table "item_steps" violates foreign key constraint "item_steps_item_id_fkey"' },
  { code: 'PGRST301', message: 'JWT expired' },
  new TypeError('undefined is not an object (evaluating \'d.prep\')'),
  null,
  'boom',
];
for (const e of raw) assert.equal(saveErrorWords(e), 'Something went wrong saving it. Try again.');
