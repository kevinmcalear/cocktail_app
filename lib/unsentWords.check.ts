import assert from 'node:assert/strict';

import { unsentDetail, unsentTitle } from './unsentRows';
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
