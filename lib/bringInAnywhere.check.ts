import assert from 'node:assert/strict';

import { bringInChoice, isEditable, isLink, isTextFile } from './bringInAnywhere';

const f = (type: string) => ({ type, name: '' });

// Photos, PDFs, text and .csv, at most twelve, in order; anything else is skipped.
assert.deepEqual(bringInChoice([f('image/jpeg'), f('text/html'), f('application/pdf')], null), { files: [0, 2] });
assert.equal((bringInChoice(Array(14).fill(f('image/png')), 'ignored when there are files') as { files: number[] }).files.length, 12);
assert.deepEqual(bringInChoice([f('text/plain'), f('text/csv'), { type: '', name: 'house-specs.csv' }, f('application/zip')], null), { files: [0, 1, 2] });
assert.equal(isTextFile('', 'notes.md'), true);
assert.equal(isTextFile('application/octet-stream', 'menu.pdf'), false);

// Text: two lines or a sentence; not a word, not a lone link.
assert.deepEqual(bringInChoice([], '  Negroni\n30 ml Gin  '), { text: 'Negroni\n30 ml Gin' });
assert.deepEqual(bringInChoice([], 'Orchard Fizz: calvados, pear and lemon'), { text: 'Orchard Fizz: calvados, pear and lemon' });
assert.equal(bringInChoice([], 'Negroni'), null);
assert.deepEqual(bringInChoice([], ' https://punchdrink.com/recipes/negroni/ '), { text: 'https://punchdrink.com/recipes/negroni/' });
assert.equal(bringInChoice([], '   '), null);
assert.equal(bringInChoice([], null), null);

assert.equal(isLink('https://x.co/a'), true);
assert.equal(isLink('see https://x.co/a'), false);
assert.equal(isLink('ftp://x.co/a'), false);

assert.equal(isEditable({ tagName: 'TEXTAREA' }), true);
assert.equal(isEditable({ tagName: 'INPUT' }), true);
assert.equal(isEditable({ tagName: 'DIV', isContentEditable: true }), true);
assert.equal(isEditable({ tagName: 'DIV' }), false);
assert.equal(isEditable(null), false);

console.log('bringInAnywhere: ok');
