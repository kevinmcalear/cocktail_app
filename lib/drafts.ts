import { supabase } from '@/lib/supabase';

/**
 * Recursively publishes a draft ingredient and all its draft sub-ingredients,
 * returning the new published items table ID.
 */
export async function resolveIngredientId(id: string, drafts: any[]): Promise<string> {
    const draft = drafts.find(d => d.id === id);
    if (!draft || draft.entity_type !== 'ingredient') {
        // Not a draft or not an ingredient draft, return the original ID
        return id;
    }
    
    const data = draft.draft_data;
    
    // Resolve any sub-recipe items if they are drafts
    const resolvedRecipeItems = [];
    if (data.recipeItems && data.recipeItems.length > 0) {
        for (const subItem of data.recipeItems) {
            const resolvedSubId = await resolveIngredientId(subItem.ingredient_id, drafts);
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
            name: data.name?.trim() || "Untitled Ingredient",
            description: data.description?.trim() || null,
            item_type: 'ingredient',
            brand_maker: data.brandMaker?.trim() || null,
            abv: data.abv ? parseFloat(data.abv) : null,
            bar_id: data.barId || null,
            override_visibility_level: data.overrideVisibility ? parseInt(data.overrideVisibility) : null,
            override_generic_ingredient_level: data.overrideGeneric ? parseInt(data.overrideGeneric) : null,
            override_specific_brand_level: data.overrideSpecific ? parseInt(data.overrideSpecific) : null,
            override_measurement_level: data.overrideMeasurement ? parseInt(data.overrideMeasurement) : null,
            override_prep_level: data.overridePrep ? parseInt(data.overridePrep) : null,
        })
        .select()
        .single();
        
    if (ingredientError || !ingredient) throw ingredientError;
    
    const ingredientId = ingredient.id;
    
    // Insert categories
    if (data.selectedCategories && data.selectedCategories.length > 0) {
        for (const catId of data.selectedCategories) {
            await supabase
                .from('item_categories')
                .upsert({
                    item_id: ingredientId,
                    category_id: catId,
                    is_primary: true
                }, { onConflict: 'item_id,category_id' });
        }
    }
    
    // Insert recipe items
    if (resolvedRecipeItems.length > 0) {
        const recipeInserts = resolvedRecipeItems.map(item => ({
            recipe_item_id: ingredientId,
            ingredient_item_id: item.ingredient_id,
            amount: parseFloat(item.amount) || null,
            unit: item.unit || null,
        }));
        
        const { error: recipeError } = await supabase
            .from('recipes')
            .insert(recipeInserts);
            
        if (recipeError) throw recipeError;
    }
    
    // Delete the draft from the drafts table
    await supabase.from('drafts').delete().eq('id', draft.id);
    
    return ingredientId;
}

/**
 * Scans all user drafts and updates references to an old draft ID with the new published ID.
 */
export async function updateParentDraftsWithPublishedId(
    oldDraftId: string, 
    newPublishedId: string, 
    userDrafts: any[], 
    saveDraftFn: any
) {
    for (const draft of userDrafts) {
        if (!draft.draft_data || !draft.draft_data.recipeItems) continue;
        
        let changed = false;
        const updatedRecipeItems = draft.draft_data.recipeItems.map((item: any) => {
            if (item.ingredient_id === oldDraftId) {
                changed = true;
                return {
                    ...item,
                    ingredient_id: newPublishedId
                };
            }
            return item;
        });
        
        if (changed) {
            const updatedDraftData = {
                ...draft.draft_data,
                recipeItems: updatedRecipeItems
            };
            await saveDraftFn({
                id: draft.id,
                entityType: draft.entity_type,
                draftData: updatedDraftData
            });
        }
    }
}
