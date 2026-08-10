import type { SortableRecipeItem } from '@/components/recipe/SortableRecipeList';
import {
    applyCreateToParent,
    defaultBatchName,
    planMerge,
} from '@/lib/mergeRecipeItems';
import { supabase } from '@/lib/supabase';
import { getPreferredUnit } from '@/store/useSettingsStore';

type SaveDraftFn = (args: {
    id?: string;
    entityType: string;
    draftData: any;
}) => Promise<any>;

export async function fetchBatchIngredientIds(ids: string[]): Promise<Set<string>> {
    const unique = [...new Set(ids.filter(Boolean))];
    if (unique.length === 0) return new Set();
    const { data, error } = await supabase
        .from('recipes')
        .select('recipe_item_id')
        .in('recipe_item_id', unique);
    if (error) throw error;
    return new Set((data || []).map((r: { recipe_item_id: string }) => r.recipe_item_id));
}

function isDraftBatch(drafts: any[] | undefined, id: string): boolean {
    const draft = drafts?.find((d) => d.id === id && d.entity_type === 'ingredient');
    return (draft?.draft_data?.recipeItems?.length ?? 0) > 0;
}

export function makeIsBatchIngredient(
    drafts: any[] | undefined,
    knownBatchIds: Set<string>
): (id: string) => boolean {
    return (id: string) => knownBatchIds.has(id) || isDraftBatch(drafts, id);
}

async function createPublishedBatch(
    childItems: SortableRecipeItem[],
    barId: string | null,
    name: string
): Promise<{ id: string; name: string }> {
    const { data: ingredient, error } = await supabase
        .from('items')
        .insert({
            name,
            item_type: 'ingredient',
            bar_id: barId,
        })
        .select('id, name')
        .single();
    if (error || !ingredient) throw error;

    if (childItems.length > 0) {
        const { error: recipeError } = await supabase.from('recipes').insert(
            childItems.map((item, index) => ({
                recipe_item_id: ingredient.id,
                ingredient_item_id: item.ingredient_id,
                amount: parseFloat(item.amount) || null,
                unit: item.unit || null,
                preparation_notes: item.preparation_notes || null,
                is_optional: item.is_optional || false,
                sort_order: index,
            }))
        );
        if (recipeError) throw recipeError;
    }
    return ingredient;
}

async function appendToPublishedBatch(
    batchId: string,
    appendItem: SortableRecipeItem
): Promise<void> {
    const { data: existing, error: fetchError } = await supabase
        .from('recipes')
        .select('sort_order')
        .eq('recipe_item_id', batchId)
        .order('sort_order', { ascending: false })
        .limit(1);
    if (fetchError) throw fetchError;
    const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;
    const { error } = await supabase.from('recipes').insert({
        recipe_item_id: batchId,
        ingredient_item_id: appendItem.ingredient_id,
        amount: parseFloat(appendItem.amount) || null,
        unit: appendItem.unit || null,
        preparation_notes: appendItem.preparation_notes || null,
        is_optional: appendItem.is_optional || false,
        sort_order: nextOrder,
    });
    if (error) throw error;
}

async function createDraftBatch(
    childItems: SortableRecipeItem[],
    barId: string | null,
    saveDraft: SaveDraftFn,
    name: string
): Promise<{ id: string; name: string }> {
    const result = await saveDraft({
        entityType: 'ingredient',
        draftData: {
            name,
            recipeItems: childItems,
            barId,
        },
    });
    if (!result?.id) throw new Error('Failed to create batch draft');
    return { id: result.id, name };
}

async function appendToDraftOrPublishedBatch(
    batchId: string,
    appendItem: SortableRecipeItem,
    drafts: any[] | undefined,
    saveDraft: SaveDraftFn | undefined
): Promise<void> {
    const draft = drafts?.find((d) => d.id === batchId && d.entity_type === 'ingredient');
    if (draft && saveDraft) {
        const recipeItems = [...(draft.draft_data?.recipeItems || []), appendItem];
        await saveDraft({
            id: batchId,
            entityType: 'ingredient',
            draftData: { ...draft.draft_data, recipeItems },
        });
        return;
    }
    await appendToPublishedBatch(batchId, appendItem);
}

export async function executeRecipeMerge(args: {
    items: SortableRecipeItem[];
    fromIndex: number;
    targetIndex: number;
    isBatch: (id: string) => boolean;
    persistence: 'draft' | 'published';
    barId?: string | null;
    drafts?: any[];
    saveDraft?: SaveDraftFn;
    /** Parent cocktail/ingredient name → "{name} batch". */
    parentName?: string | null;
}): Promise<{ nextItems: SortableRecipeItem[]; newBatchId?: string } | null> {
    const plan = planMerge(args.items, args.fromIndex, args.targetIndex, args.isBatch);
    if (!plan) return null;

    if (plan.mode === 'append') {
        await appendToDraftOrPublishedBatch(
            plan.batchIngredientId,
            plan.appendItem,
            args.drafts,
            args.saveDraft
        );
        return { nextItems: plan.nextParentItems };
    }

    // create
    const batchName = defaultBatchName(args.parentName);
    let batch: { id: string; name: string };
    if (args.persistence === 'draft') {
        if (!args.saveDraft) throw new Error('saveDraft required for draft merge');
        batch = await createDraftBatch(
            plan.childItems,
            args.barId ?? null,
            args.saveDraft,
            batchName
        );
    } else {
        batch = await createPublishedBatch(plan.childItems, args.barId ?? null, batchName);
    }

    const batchLine: SortableRecipeItem = {
        ingredient_id: batch.id,
        name: batch.name,
        amount: '',
        unit: getPreferredUnit(),
    };
    return {
        nextItems: applyCreateToParent(
            args.items,
            args.fromIndex,
            args.targetIndex,
            batchLine
        ),
        newBatchId: batch.id,
    };
}
