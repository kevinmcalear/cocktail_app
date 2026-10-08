import assert from 'node:assert/strict';

import { editModeRedirect, menuCreateRedirect } from './legacyCreatorRoutes';

assert.equal(editModeRedirect({}), '/drafts');
assert.equal(editModeRedirect({ type: 'drink_draft', id: 'd1' }), '/drafts');
assert.equal(editModeRedirect({ create: 'menu', barId: 'b1' }), '/menus/all?new=1');
assert.equal(editModeRedirect({ create: 'beer', barId: 'bar-1', name: 'Hazy IPA' }), '/add-beer?barId=bar-1&name=Hazy%20IPA');
assert.equal(editModeRedirect({ create: 'cocktail', barId: 'personal' }), '/add-cocktail');
assert.equal(editModeRedirect({ create: 'spaceship' }), '/drafts');
assert.equal(editModeRedirect({ type: 'published_menu', id: 'm1' }), '/menus/m1');
assert.equal(editModeRedirect({ type: 'published_drink', id: 'wine-9' }), '/wine/wine-9');
assert.equal(editModeRedirect({ type: 'published_drink', id: 'c1' }), '/cocktail/c1');
assert.equal(editModeRedirect({ type: 'published_ingredient', id: 'i1' }), '/ingredient/i1');

assert.equal(menuCreateRedirect({ menuId: 'm1' }), '/menus/m1/edit');
assert.equal(menuCreateRedirect({ draftId: 'd1' }), '/drafts');
assert.equal(menuCreateRedirect({}), '/menus/all?new=1');

console.log('legacyCreatorRoutes checks passed');
