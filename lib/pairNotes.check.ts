import assert from 'node:assert/strict';

import { cleanNote, notesPrompt, parseNotes, tasteWords } from '../supabase/functions/_shared/pairNotes';

// The rules give each side's taste in words.
assert.match(tasteWords('Mezcal'), /smoky/);
assert.match(tasteWords('Lime Juice'), /sour/);
assert.equal(tasteWords('Fermented Plum Koji Thing'), '');

const pairs = [
  { a_id: 'a', b_id: 'b', a_name: 'Mezcal', b_name: 'Agave Syrup', together: 15, drinks: ['Oaxaca Old Fashioned', 'Mezcal Margarita'] },
  { a_id: 'c', b_id: 'd', a_name: 'Gin', b_name: 'Dry Vermouth', together: 17, drinks: [] },
];
const prompt = notesPrompt(pairs);
assert.match(prompt, /a\|b: Mezcal \(.*smoky.*\) with Agave Syrup/);
assert.match(prompt, /no chemistry/);
assert.ok(!prompt.includes('\u2014'), 'the prompt itself has no em dashes');

// Notes are one plain sentence; dashes and shouting are tidied, the rest refused.
assert.equal(cleanNote('Agave syrup rounds off the smoke and brings the spirit back to its plant.'), 'Agave syrup rounds off the smoke and brings the spirit back to its plant.');
assert.equal(cleanNote('Smoke meets sweet \u2014 a natural match for sipping slowly'), 'Smoke meets sweet, a natural match for sipping slowly.');
assert.equal(cleanNote('Great!'), null, 'too short');
assert.equal(cleanNote('They share a terpene that makes the pair taste brighter together in the glass.'), null, 'no chemistry claims');
assert.equal(cleanNote('One sentence here about taste. And a second sentence about history too.'), null, 'one sentence');
assert.equal(cleanNote(42), null);

// Only the pairs asked about, each once, and only good notes.
const parsed = parseNotes(
  JSON.stringify({
    notes: [
      { id: 'a|b', note: 'Agave syrup softens the smoke and echoes the plant mezcal is made from.' },
      { id: 'a|b', note: 'A second note for the same pair should be ignored entirely here.' },
      { id: 'x|y', note: 'A pair nobody asked about should never be saved by the worker.' },
      { id: 'c|d', note: 'Bad!' },
    ],
  }),
  pairs
);
assert.deepEqual(parsed, [{ a_id: 'a', b_id: 'b', note: 'Agave syrup softens the smoke and echoes the plant mezcal is made from.' }]);
assert.deepEqual(parseNotes('not json', pairs), []);

console.log('pairNotes checks passed');
