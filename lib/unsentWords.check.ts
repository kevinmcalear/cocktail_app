import assert from 'node:assert/strict';

import { unsentAction, unsentDetail, unsentTitle } from './unsentRows';
import { didntSendWords, waitingWords } from './unsentWords';

assert.equal(waitingWords(1), '1 change waiting to send');
assert.equal(waitingWords(3), '3 changes waiting to send');
assert.equal(didntSendWords(2), '2 changes didn’t send');

// Each write says what it changes, from what it sends.
assert.equal(unsentTitle(['bar-write', 'new-drink'], { draft: { name: ' Pine Old Fashioned ' } }), 'Pine Old Fashioned, a new drink');
assert.equal(unsentTitle(['bar-write', 'new-drink'], { draft: { name: '' } }), 'A new drink');
assert.equal(unsentTitle(['bar-write', 'menu-layout'], { name: 'Autumn' }), 'Changes to Autumn');
assert.equal(unsentTitle(['bar-write', 'off-tonight'], { until: '2026-11-13T05:00:00Z' }), 'A drink off tonight');
assert.equal(unsentTitle(['bar-write', 'off-tonight'], { until: null }), 'A drink back on tonight');
// One the app doesn't know (a newer kind restored by an older build) still gets a row.
assert.equal(unsentTitle(['bar-write', 'something-new'], {}), 'A change');
assert.equal(unsentTitle(undefined, null), 'A change');

const time = () => '9:14pm';
assert.equal(unsentDetail(null, 1, time), 'Made 9:14pm · waiting for a connection');
assert.equal(unsentDetail('You can’t change this menu.', 1, time), 'Made 9:14pm · didn’t send: You can’t change this menu.');

// Third review: a batch set aside at launch says how many, and can only be discarded; a refused new drink opens
// in Add (Send would send the same refused save), one that only lost its connection is sent again.
assert.equal(unsentTitle(['bar-write', 'set-aside'], { at: 1, count: 2 }), '2 changes this phone couldn’t read back');
assert.equal(unsentTitle(['bar-write', 'set-aside'], { at: 1, count: 0 }), 'Changes this phone couldn’t read back');
assert.equal(unsentAction(['bar-write', 'set-aside'], 'x', false), null);
assert.equal(unsentAction(['bar-write', 'new-drink'], 'Name taken.', false), 'add');
assert.equal(unsentAction(['bar-write', 'new-drink'], 'Network request failed', true), 'send');
assert.equal(unsentAction(['bar-write', 'new-drink'], null, false), 'send');
assert.equal(unsentAction(['bar-write', 'menu-layout'], 'Name taken.', false), 'send');
