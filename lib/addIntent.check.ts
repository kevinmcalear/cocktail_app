import assert from 'node:assert/strict';

import { addIntent, clipLine } from './addIntent';

assert.equal(addIntent(''), null);
assert.equal(addIntent('  smoke signal '), 'name');
assert.equal(addIntent('Negroni'), 'name');
assert.equal(addIntent('a negroni but with mezcal'), 'read');
assert.equal(addIntent('Negroni with mezcal'), 'read');
assert.equal(addIntent('https://www.instagram.com/reel/C9xAbc'), 'read');
assert.equal(addIntent('45 calvados, 15 pear'), 'read');
assert.equal(addIntent('Orchard Fizz\ncalvados\npear'), 'read');

assert.equal(clipLine('https://www.instagram.com/reel/C9xAbcdefghijk'), 'instagram.com/reel/C9xAbcde…');
assert.equal(clipLine('short'), 'short');
