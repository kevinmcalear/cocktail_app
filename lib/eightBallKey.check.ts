// Checks for lib/eightBallKey.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { eightBallLabel, isEightBallKey } from './eightBallKey';

const key = (k: Partial<KeyboardEvent>) => ({ key: '8', code: 'Digit8', metaKey: false, ctrlKey: false, shiftKey: false, ...k });

assert.equal(eightBallLabel({ shift: false, apple: true }), '⌘8', 'desktop app on a Mac');
assert.equal(eightBallLabel({ shift: true, apple: true }), '⇧⌘8', 'web on a Mac');
assert.equal(eightBallLabel({ shift: false, apple: false }), 'Ctrl 8');
assert.equal(eightBallLabel({ shift: true, apple: false }), 'Shift Ctrl 8');

// Desktop app: ⌘8 or Ctrl+8, not with Shift, not a bare 8.
assert.equal(isEightBallKey(key({ metaKey: true }), false), true);
assert.equal(isEightBallKey(key({ ctrlKey: true }), false), true);
assert.equal(isEightBallKey(key({}), false), false, 'a bare 8 is typing');
assert.equal(isEightBallKey(key({ metaKey: true, shiftKey: true, key: '*' }), false), false);

// Web: only with Shift, so the browser keeps ⌘8 for its eighth tab.
assert.equal(isEightBallKey(key({ metaKey: true }), true), false, 'plain ⌘8 is the browser tab switch');
assert.equal(isEightBallKey(key({ metaKey: true, shiftKey: true, key: '*' }), true), true, 'US layout: Shift turns 8 into *');
assert.equal(isEightBallKey(key({ ctrlKey: true, shiftKey: true, key: '8', code: 'Digit8' }), true), true);
assert.equal(isEightBallKey(key({ metaKey: true, shiftKey: true, key: '(', code: 'Digit9' }), true), false, 'another digit');

console.log('eightBallKey checks passed');
