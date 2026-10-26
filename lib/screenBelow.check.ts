import assert from 'node:assert/strict';
import { screenBelow } from './screenBelow';

const menu = { name: 'p/[id]/menus/[edition]', params: { id: 'bar-1', edition: 'm-1' } };
const own = { id: 'bar-1', edition: 'm-1' };

// Nothing under it.
assert.equal(screenBelow(undefined, own), null);
assert.equal(screenBelow({ index: 0, routes: [menu] }, own), null);

// Opened from a link: the anchor under it carries the page's own params.
assert.equal(screenBelow({ index: 1, routes: [{ name: '(tabs)', params: { ...own } }, menu] }, own), null);

// Opened from the bar's page, or from Home: that's what's under it.
assert.deepEqual(screenBelow({ index: 1, routes: [{ name: 'p/[id]/index', params: { id: 'bar-1' } }, menu] }, own), { name: 'p/[id]/index', params: { id: 'bar-1' } });
assert.deepEqual(screenBelow({ index: 1, routes: [{ name: '(tabs)' }, menu] }, own), { name: '(tabs)', params: {} });

// Looks under the top screen, not the end of the list.
assert.equal(screenBelow({ index: 0, routes: [menu, { name: 'cocktail/[id]' }] }, own), null);
