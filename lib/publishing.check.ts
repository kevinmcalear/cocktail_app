import assert from 'node:assert/strict';

import { describePublish, effectivePublish, mostOpen } from './publishing';

// Mirrors private.effective_publish_mode in 20260930000400.
assert.deepEqual(effectivePublish({ own: null, menuModes: [], barDefault: 'spec' }), { mode: 'spec', source: 'bar' });
assert.deepEqual(effectivePublish({ own: 'private', menuModes: ['spec'], barDefault: 'spec' }), { mode: 'private', source: 'drink' });
assert.deepEqual(effectivePublish({ own: null, menuModes: [null, 'description'], barDefault: 'private' }), { mode: 'description', source: 'menu' });
// The most open menu wins over a closed one.
assert.deepEqual(effectivePublish({ own: null, menuModes: ['private', 'spec'], barDefault: 'private' }), { mode: 'spec', source: 'menu' });
// A menu set to private still beats an open bar (it's an explicit choice).
assert.deepEqual(effectivePublish({ own: null, menuModes: ['private'], barDefault: 'spec' }), { mode: 'private', source: 'menu' });
// A personal drink: no bar, only its own setting.
assert.deepEqual(effectivePublish({ own: null, menuModes: [], barDefault: null }), { mode: 'private', source: 'none' });

assert.equal(mostOpen([null, undefined]), null);
assert.equal(describePublish('spec', 'bar'), "Full spec, from the bar's default");

console.log('publishing: ok');
