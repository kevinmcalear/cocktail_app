import { reportError } from '@/lib/monitoring';
import { supabase } from '@/lib/supabase';
import { capitalize, capitalizeFirst } from '@/lib/stringUtils';

/**
 * A published ingredient a draft line points at. Ingredients merged since the
 * draft was saved are deleted (20261008100000), and the old name stays as an
 * alias of the kept one, so a missing id goes by its line's name instead.
 */
async function liveIngredientId(id: string, name?: string): Promise<string> {
    const { data, error } = await supabase.from('items').select('id').eq('id', id).maybeSingle();
    if (error) throw error;
    if (data) return id;
    const resolved = name?.trim() ? await supabase.rpc('resolve_ingredient', { p_name: name }) : null;
    if (resolved?.data) return resolved.data as string;
    throw new Error(`${name?.trim() || 'An ingredient'} isn’t in the catalog any more. Pick it again.`);
}

/**
 * Recursively publishes a draft ingredient and all its draft sub-ingredients,
 * returning the new published items table ID.
 */
export async function resolveIngredientId(id: string, drafts: any[], name?: string): Promise<string> {
    const draft = drafts.find(d => d.id === id);
    if (!draft || draft.entity_type !== 'ingredient') {
        // Not a draft or not an ingredient draft: a published id, if it still exists
        return liveIngredientId(id, name);
    }
    
    const data = draft.draft_data;
    
    // Resolve any sub-recipe items if they are drafts
    const resolvedRecipeItems = [];
    if (data.recipeItems && data.recipeItems.length > 0) {
        for (const subItem of data.recipeItems) {
            const resolvedSubId = await resolveIngredientId(subItem.ingredient_id, drafts, subItem.name);
            resolvedRecipeItems.push({
                ...subItem,
                ingredient_id: resolvedSubId
            });
        }
    }
    
    // Insert ingredient into items table
    const { data: ingredient, error: ingredientError } = await supabase
        .from('items')
        .insert({
            name: capitalizeFirst(data.name) || "Untitled Ingredient",
            description: data.description?.trim() || null,
            item_type: 'ingredient',
            brand_maker: capitalize(data.brandMaker) || null,
            generic_id: data.generic?.id || null,
            abv: data.abv ? parseFloat(data.abv) : null,
            bar_id: data.barId || null,
            override_visibility_level: data.overrideVisibility ? parseInt(data.overrideVisibility) : null,
            override_generic_ingredient_level: data.overrideGeneric ? parseInt(data.overrideGeneric) : null,
            override_specific_brand_level: data.overrideSpecific ? parseInt(data.overrideSpecific) : null,
            override_measurement_level: data.overrideMeasurement ? parseInt(data.overrideMeasurement) : null,
            override_prep_level: data.overridePrep ? parseInt(data.overridePrep) : null,
            hide_from_search: data.hideFromSearch === true,
        })
        .select()
        .single();
        
    if (ingredientError || !ingredient) throw ingredientError;
    
    const ingredientId = ingredient.id;
    
    // A half-made ingredient is removed again, so the draft stays and trying again doesn't leave a copy.
    try {
        // Insert categories
        if (data.selectedCategories && data.selectedCategories.length > 0) {
            for (const catId of data.selectedCategories) {
                const { error: categoryError } = await supabase
                    .from('item_categories')
                    .upsert({
                        item_id: ingredientId,
                        category_id: catId,
                        is_primary: true
                    }, { onConflict: 'item_id,category_id' });
                if (categoryError) throw categoryError;
            }
        }

        // Insert recipe items
        if (resolvedRecipeItems.length > 0) {
            const recipeInserts = resolvedRecipeItems.map((item, index) => ({
                recipe_item_id: ingredientId,
                ingredient_item_id: item.ingredient_id,
                amount: parseFloat(item.amount) || null,
                unit: item.unit || null,
                sort_order: index,
            }));

            const { error: recipeError } = await supabase
                .from('recipes')
                .insert(recipeInserts);

            if (recipeError) throw recipeError;
        }
    } catch (e) {
        await supabase.from('items').delete().eq('id', ingredientId);
        throw e;
    }

    // The ingredient is published by now, so a draft that won't delete is only
    // reported: throwing would make the caller publish it again on retry.
    const { error: draftError } = await supabase.from('drafts').delete().eq('id', draft.id);
    if (draftError) reportError(draftError, { where: 'resolveIngredientId', step: 'delete draft' });

    return ingredientId;
}

/**
 * Rename an ingredient entity in place (draft or published).
 * Caller updates its own recipe line; skips parent sync so unsaved parent edits aren't clobbered.
 */
export async function renameIngredientEntity(
    ingredientId: string,
    name: string,
    drafts: any[],
    saveDraftFn: any
): Promise<string> {
    const displayName = capitalizeFirst(name);
    if (!displayName || !ingredientId) return displayName;

    const draft = drafts.find((d) => d.id === ingredientId && d.entity_type === 'ingredient');
    if (draft) {
        await saveDraftFn({
            id: ingredientId,
            entityType: 'ingredient',
            draftData: { ...draft.draft_data, name: displayName },
        });
        return displayName;
    }

    const { error } = await supabase.from('items').update({ name: displayName }).eq('id', ingredientId);
    if (error) throw error;
    return displayName;
}

/**
 * Patch recipe lines in other drafts that point at this ingredient
 * (e.g. rename a merge-created batch so the parent cocktail line updates).
 */
export async function syncIngredientRefsInParentDrafts(
    ingredientId: string,
    patch: { ingredient_id?: string; name?: string },
    userDrafts: any[],
    saveDraftFn: any
) {
    for (const draft of userDrafts) {
        if (!draft.draft_data || !draft.draft_data.recipeItems) continue;
        if (draft.id === ingredientId) continue;

        let changed = false;
        const updatedRecipeItems = draft.draft_data.recipeItems.map((item: any) => {
            if (item.ingredient_id !== ingredientId) return item;
            changed = true;
            return {
                ...item,
                ...(patch.ingredient_id ? { ingredient_id: patch.ingredient_id } : {}),
                ...(patch.name != null ? { name: patch.name } : {}),
            };
        });

        if (changed) {
            await saveDraftFn({
                id: draft.id,
                entityType: draft.entity_type,
                draftData: {
                    ...draft.draft_data,
                    recipeItems: updatedRecipeItems,
                },
            });
        }
    }
}

/**
 * Scans all user drafts and updates references to an old draft ID with the new published ID.
 */
export async function updateParentDraftsWithPublishedId(
    oldDraftId: string,
    newPublishedId: string,
    userDrafts: any[],
    saveDraftFn: any,
    name?: string
) {
    await syncIngredientRefsInParentDrafts(
        oldDraftId,
        {
            ingredient_id: newPublishedId,
            ...(name != null ? { name } : {}),
        },
        userDrafts,
        saveDraftFn
    );
}

/**
 * Scans all user drafts and updates references to an old menu item draft ID
 * with the new published ID inside menu drafts.
 */
export async function updateMenuDraftsWithPublishedId(
    oldDraftId: string, 
    newPublishedId: string, 
    userDrafts: any[], 
    saveDraftFn: any
) {
    for (const draft of userDrafts) {
        if (draft.entity_type !== 'menu' || !draft.draft_data || !draft.draft_data.selections) continue;
        
        let changed = false;
        const updatedSelections: Record<string, any> = {};
        const selections = (draft.draft_data.selections || {}) as Record<string, any>;
        
        for (const [sectionId, drinks] of Object.entries(selections)) {
            if (!Array.isArray(drinks)) {
                updatedSelections[sectionId] = drinks;
                continue;
            }
            const updatedDrinks = drinks.map((id: any) => {
                if (id === oldDraftId) {
                    changed = true;
                    return newPublishedId;
                }
                return id;
            });
            updatedSelections[sectionId] = updatedDrinks;
        }
        
        if (changed) {
            const updatedDraftData = {
                ...draft.draft_data,
                selections: updatedSelections
            };
            await saveDraftFn({
                id: draft.id,
                entityType: draft.entity_type,
                draftData: updatedDraftData
            });
        }
    }
}

