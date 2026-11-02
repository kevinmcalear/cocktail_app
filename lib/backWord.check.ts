import assert from 'node:assert/strict';

import { backWord } from './tabs';

// A page's own title is what Back says; a tab's first page has only a route name.
assert.equal(backWord('Negroni'), 'Negroni');
assert.equal(backWord('index'), 'Tonight');
assert.equal(backWord('drinks'), 'Drinks');
assert.equal(backWord('search'), 'Search');
assert.equal(backWord('prep'), 'Prep');
// Nothing under it, or a route path that never got a title.
assert.equal(backWord(undefined), 'Back');
assert.equal(backWord('cocktail/[id]/index'), 'Back');
