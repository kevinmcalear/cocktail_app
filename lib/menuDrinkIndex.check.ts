import assert from 'node:assert/strict';
import { buildMenuDrinkIndex } from './menuDrinkIndex';

const map = buildMenuDrinkIndex({
    drafts: [
        {
            id: 'draft-1',
            entity_type: 'cocktail',
            draft_data: { name: 'dark and stormy' },
        },
        {
            id: 'draft-beer',
            entity_type: 'beer',
            draft_data: { name: 'house lager' },
        },
    ],
    cocktails: [{ id: 'pub-1', name: 'martini', description: '', recipes: [], item_images: [] }],
});

assert.equal(map.get('draft-1')?.name, 'Dark And Stormy');
assert.equal(map.get('draft-1')?.isDraft, true);
assert.equal(typeof map.get('draft-1')?.draftProgress?.percentage, 'number');
assert.equal(map.get('beer-draft-beer')?.name, 'House Lager');
assert.equal(typeof map.get('beer-draft-beer')?.draftProgress?.percentage, 'number');
assert.equal(map.get('pub-1')?.name, 'Martini');
assert.equal(map.get('pub-1')?.draftProgress, undefined);
assert.equal(map.get('missing')?.name ?? 'Unknown', 'Unknown');

console.log('menuDrinkIndex.check: ok');
