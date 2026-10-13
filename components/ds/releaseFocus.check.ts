// Checks that a pointer press drops focus and a key press keeps it (releaseFocus.ts). Run: npm run test:unit
import assert from 'node:assert/strict';
import type { GestureResponderEvent } from 'react-native';

import { isLinkEnter, releaseFocusAfterPointer } from './releaseFocus';

const doc = { activeElement: null as unknown };
(globalThis as { document?: unknown }).document = doc;
const control = () => {
  const el = { blurred: false, blur() { this.blurred = true; doc.activeElement = null; } };
  doc.activeElement = el;
  return el;
};
const press = (el: unknown, nativeEvent: unknown) => ({ currentTarget: el, nativeEvent }) as unknown as GestureResponderEvent;

// A mouse click (detail 1): focus goes, so no ring at the next key.
let el = control();
releaseFocusAfterPointer(press(el, { detail: 1 }));
assert.equal(el.blurred, true);

// Enter on a link fires a click with detail 0: focus stays for keyboard users.
el = control();
releaseFocusAfterPointer(press(el, { detail: 0 }));
assert.equal(el.blurred, false);

// Enter or Space on a div arrives as the bare keyup event, with no nativeEvent.
el = control();
releaseFocusAfterPointer({ currentTarget: el, detail: 0 } as unknown as GestureResponderEvent);
assert.equal(el.blurred, false);

// Focus already elsewhere (the press moved it into a sheet): leave it alone.
el = control();
doc.activeElement = {};
releaseFocusAfterPointer(press(el, { detail: 1 }));
assert.equal(el.blurred, false);

// Enter opens a link row drawn as a div; a real anchor, Space, and buttons are left to the browser and RNW.
assert.equal(isLinkEnter('link', 'Enter', { tagName: 'DIV' }), true);
assert.equal(isLinkEnter('link', 'Enter', { tagName: 'A' }), false);
assert.equal(isLinkEnter('link', ' ', { tagName: 'DIV' }), false);
assert.equal(isLinkEnter('button', 'Enter', { tagName: 'DIV' }), false);

delete (globalThis as { document?: unknown }).document;
console.log('releaseFocus: ok');
