import assert from 'node:assert/strict';

import { capitalize } from '@/lib/stringUtils';

// ponytail: mirrors renameIngredientEntity draft vs published branch
function planRename(
    ingredientId: string,
    name: string,
    drafts: { id: string; entity_type: string; draft_data: any }[]
): { kind: 'draft'; draftData: any; name: string } | { kind: 'published'; name: string } | null {
    const displayName = capitalize(name.trim());
    if (!displayName || !ingredientId) return null;
    const draft = drafts.find((d) => d.id === ingredientId && d.entity_type === 'ingredient');
    if (draft) {
        return { kind: 'draft', draftData: { ...draft.draft_data, name: displayName }, name: displayName };
    }
    return { kind: 'published', name: displayName };
}

const drafts = [
    {
        id: 'batch-draft',
        entity_type: 'ingredient',
        draft_data: { name: 'New batch', recipeItems: [{ ingredient_id: 'gin', name: 'Gin' }] },
    },
];

const draftRename = planRename('batch-draft', '  fat wash batch ', drafts);
assert.equal(draftRename?.kind, 'draft');
assert.equal(draftRename?.name, 'Fat Wash Batch');
if (draftRename?.kind === 'draft') {
    assert.equal(draftRename.draftData.name, 'Fat Wash Batch');
    assert.equal(draftRename.draftData.recipeItems.length, 1);
}

const publishedRename = planRename('pub-1', 'house syrup', drafts);
assert.equal(publishedRename?.kind, 'published');
assert.equal(publishedRename?.name, 'House Syrup');

assert.equal(planRename('batch-draft', '   ', drafts), null);

console.log('renameIngredient.check.ts: ok');
