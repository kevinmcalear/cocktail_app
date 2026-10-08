import assert from 'node:assert/strict';

import { bringInChoice, isEditable } from './bringInAnywhere';

const f = (type: string) => ({ type });

// Photos and PDFs, at most four, in order; anything else is skipped.
assert.deepEqual(bringInChoice([f('image/jpeg'), f('text/html'), f('application/pdf')], null), { files: [0, 2] });
assert.deepEqual(bringInChoice(Array(6).fill(f('image/png')), 'ignored when there are files'), { files: [0, 1, 2, 3] });
assert.equal(bringInChoice([f('text/plain')], null), null);

// Text: two lines or a sentence; not a word, not a lone link.
assert.deepEqual(bringInChoice([], '  Negroni\n30 ml Gin  '), { text: 'Negroni\n30 ml Gin' });
assert.deepEqual(bringInChoice([], 'Orchard Fizz: calvados, pear and lemon'), { text: 'Orchard Fizz: calvados, pear and lemon' });
assert.equal(bringInChoice([], 'Negroni'), null);
assert.equal(bringInChoice([], 'https://example.com/a-very-long-recipe-link'), null);
assert.equal(bringInChoice([], '   '), null);
assert.equal(bringInChoice([], null), null);

assert.equal(isEditable({ tagName: 'TEXTAREA' }), true);
assert.equal(isEditable({ tagName: 'INPUT' }), true);
assert.equal(isEditable({ tagName: 'DIV', isContentEditable: true }), true);
assert.equal(isEditable({ tagName: 'DIV' }), false);
assert.equal(isEditable(null), false);

console.log('bringInAnywhere: ok');
