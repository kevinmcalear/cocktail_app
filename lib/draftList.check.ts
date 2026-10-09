import assert from 'node:assert/strict';

import { draftHref, draftTitle, groupDrafts } from './draftList';

assert.equal(draftHref({ id: 'a1', entity_type: 'cocktail' }), '/add-cocktail?draftId=a1');
assert.equal(draftHref({ id: 'a1', entity_type: 'beer', bar_id: 'b 1' }), '/add-beer?draftId=a1&barId=b%201');
assert.equal(draftHref({ id: 'a1', entity_type: 'ingredient', bar_id: null }), '/add-ingredient?draftId=a1');
assert.equal(draftHref({ id: 'a1', entity_type: 'menu' }), null);
assert.equal(draftHref({ id: 'a1', entity_type: 'spaceship' }), null);

assert.equal(draftTitle({ id: '1', entity_type: 'cocktail', updated_at: '', draft_data: { name: ' Paloma ' } }), 'Paloma');
assert.equal(draftTitle({ id: '1', entity_type: 'menu', updated_at: '', draft_data: { menuName: 'Spring' } }), 'Spring');
assert.equal(draftTitle({ id: '1', entity_type: 'ingredient', updated_at: '', draft_data: null }), 'Untitled ingredient');

const groups = groupDrafts([
  { id: 'old-home', entity_type: 'cocktail', bar_id: null, updated_at: '2026-05-01T00:00:00Z' },
  { id: 'bar', entity_type: 'beer', bar_id: 'b1', updated_at: '2026-10-01T00:00:00Z' },
  { id: 'new-home', entity_type: 'wine', bar_id: null, updated_at: '2026-10-07T00:00:00Z' },
]);
assert.deepEqual(
  groups.map((g) => [g.barId, g.drafts.map((d) => d.id)]),
  [
    ['', ['new-home', 'old-home']],
    ['b1', ['bar']],
  ]
);

console.log('draftList checks passed');
