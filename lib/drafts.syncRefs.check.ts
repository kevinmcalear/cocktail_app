import assert from 'node:assert/strict';

// ponytail: mirrors syncIngredientRefsInParentDrafts list surgery
function syncRefs(
    ingredientId: string,
    patch: { ingredient_id?: string; name?: string },
    drafts: { id: string; entity_type: string; draft_data: any }[]
) {
    return drafts.map((draft) => {
        if (!draft.draft_data?.recipeItems || draft.id === ingredientId) return draft;
        let changed = false;
        const recipeItems = draft.draft_data.recipeItems.map((item: any) => {
            if (item.ingredient_id !== ingredientId) return item;
            changed = true;
            return {
                ...item,
                ...(patch.ingredient_id ? { ingredient_id: patch.ingredient_id } : {}),
                ...(patch.name != null ? { name: patch.name } : {}),
            };
        });
        if (!changed) return draft;
        return { ...draft, draft_data: { ...draft.draft_data, recipeItems } };
    });
}

const drafts = [
    {
        id: 'batch-draft',
        entity_type: 'ingredient',
        draft_data: { name: 'New Batch', recipeItems: [{ ingredient_id: 'gin', name: 'Gin' }] },
    },
    {
        id: 'cocktail-draft',
        entity_type: 'cocktail',
        draft_data: {
            name: 'Negroni',
            recipeItems: [{ ingredient_id: 'batch-draft', name: 'New Batch', amount: '', unit: '' }],
        },
    },
];

const renamed = syncRefs('batch-draft', { name: 'Fat Wash Negroni Batch' }, drafts);
assert.equal(renamed[0].draft_data.name, 'New Batch'); // self untouched
assert.equal(renamed[1].draft_data.recipeItems[0].name, 'Fat Wash Negroni Batch');
assert.equal(renamed[1].draft_data.recipeItems[0].ingredient_id, 'batch-draft');

const published = syncRefs(
    'batch-draft',
    { ingredient_id: 'pub-1', name: 'Fat Wash Negroni Batch' },
    drafts
);
assert.equal(published[1].draft_data.recipeItems[0].ingredient_id, 'pub-1');
assert.equal(published[1].draft_data.recipeItems[0].name, 'Fat Wash Negroni Batch');

console.log('drafts.syncRefs.check.ts: ok');
