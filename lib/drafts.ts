import { supabase } from '@/lib/supabase';
import { capitalize } from '@/lib/stringUtils';

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
            name: capitalize(data.name) || "Untitled Ingredient",
            description: data.description?.trim() || null,
            item_type: 'ingredient',
            brand_maker: capitalize(data.brandMaker) || null,
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
    
    // Delete the draft from the drafts table
    await supabase.from('drafts').delete().eq('id', draft.id);
    
    return ingredientId;
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
 * Recursively publishes a draft cocktail and all its draft ingredient dependencies,
 * returning the new published items table ID.
 */
export async function resolveCocktailId(id: string, drafts: any[]): Promise<string> {
    const draft = drafts.find(d => d.id === id);
    if (!draft || draft.entity_type !== 'cocktail') {
        // Not a draft or not a cocktail draft, return the original ID
        return id;
    }
    
    const data = draft.draft_data;
    
    // Resolve any ingredient items if they are drafts
    const resolvedRecipeItems = [];
    if (data.recipeItems && data.recipeItems.length > 0) {
        for (const item of data.recipeItems) {
            const resolvedId = await resolveIngredientId(item.ingredient_id, drafts);
            resolvedRecipeItems.push({
                ...item,
                ingredient_id: resolvedId
            });
        }
    }
    
    // Insert cocktail into items table
    const { data: cocktail, error: cocktailError } = await supabase
        .from('items')
        .insert({
            name: capitalize(data.name) || "Untitled Cocktail",
            description: data.description?.trim() || null,
            origin: capitalize(data.origin) || null,
            notes: data.notes?.trim() || null,
            glassware_id: data.glasswareId || null,
            family_id: data.familyId || null,
            ice_id: data.iceId || null,
            item_type: 'cocktail',
            bar_id: data.barId || null,
            override_visibility_level: data.overrideVisibility ? parseInt(data.overrideVisibility) : null,
            override_generic_ingredient_level: data.overrideGeneric ? parseInt(data.overrideGeneric) : null,
            override_specific_brand_level: data.overrideSpecific ? parseInt(data.overrideSpecific) : null,
            override_measurement_level: data.overrideMeasurement ? parseInt(data.overrideMeasurement) : null,
            override_prep_level: data.overridePrep ? parseInt(data.overridePrep) : null,
        })
        .select()
        .single();
        
    if (cocktailError || !cocktail) throw cocktailError;
    
    const cocktailId = cocktail.id;
    
    // Link/upload images
    if (data.localImages && data.localImages.length > 0) {
        for (let i = 0; i < data.localImages.length; i++) {
            const img = data.localImages[i];
            let imgId = img.id;
            if (!imgId && img.url) {
                const { data: existingImg } = await supabase
                    .from('images')
                    .select('id')
                    .eq('url', img.url)
                    .maybeSingle();
                if (existingImg) {
                    imgId = existingImg.id;
                } else {
                    const { data: newImg } = await supabase
                        .from('images')
                        .insert({ url: img.url })
                        .select()
                        .single();
                    if (newImg) imgId = newImg.id;
                }
            }
            if (imgId) {
                await supabase.from('item_images').insert({
                    item_id: cocktailId,
                    image_id: imgId,
                    sort_order: i
                });
            }
        }
    }
    
    // Insert recipe items
    if (resolvedRecipeItems.length > 0) {
        const recipeInserts = resolvedRecipeItems.map((item, index) => ({
            recipe_item_id: cocktailId,
            ingredient_item_id: item.ingredient_id,
            amount: parseFloat(item.amount) || null,
            unit: item.unit || null,
            preparation_notes: item.preparation_notes || null,
            is_optional: item.is_optional || false,
            sort_order: index,
        }));
        
        const { error: recipeError } = await supabase
            .from('recipes')
            .insert(recipeInserts);
            
        if (recipeError) throw recipeError;
    }
    
    // Insert method
    if (data.methodId) {
        await supabase.from('item_methods').insert({
            item_id: cocktailId,
            method_item_id: data.methodId,
            sort_order: 0
        });
    }
    
    // Delete the draft from the drafts table
    await supabase.from('drafts').delete().eq('id', draft.id);
    
    return cocktailId;
}

/**
 * Publishes a draft beer, returning the new published items table ID.
 */
export async function resolveBeerId(id: string, drafts: any[]): Promise<string> {
    const draft = drafts.find(d => d.id === id);
    if (!draft || draft.entity_type !== 'beer') {
        return id;
    }
    
    const data = draft.draft_data;
    
    const { data: beer, error: beerError } = await supabase
        .from('items')
        .insert({
            item_type: 'beer',
            name: capitalize(data.name) || "Untitled Beer",
            description: data.description?.trim() || null,
            brand_maker: capitalize(data.brewery) || null,
            abv: data.abv ? parseFloat(data.abv) : null,
            price: data.price ? parseFloat(data.price) : null,
            bar_id: data.barId || null,
            override_visibility_level: data.overrideVisibility ? parseInt(data.overrideVisibility) : null,
            override_generic_ingredient_level: data.overrideGeneric ? parseInt(data.overrideGeneric) : null,
            override_specific_brand_level: data.overrideSpecific ? parseInt(data.overrideSpecific) : null,
            override_measurement_level: data.overrideMeasurement ? parseInt(data.overrideMeasurement) : null,
            override_prep_level: data.overridePrep ? parseInt(data.overridePrep) : null,
        })
        .select()
        .single();
        
    if (beerError || !beer) throw beerError;
    
    const beerId = beer.id;
    
    // Handle Images
    if (data.localImages && data.localImages.length > 0) {
        for (let i = 0; i < data.localImages.length; i++) {
            const img = data.localImages[i];
            let imgId = img.id;
            if (!imgId && img.url) {
                const { data: existingImg } = await supabase
                    .from('images')
                    .select('id')
                    .eq('url', img.url)
                    .maybeSingle();
                if (existingImg) {
                    imgId = existingImg.id;
                } else {
                    const { data: newImg } = await supabase
                        .from('images')
                        .insert({ url: img.url })
                        .select()
                        .single();
                    if (newImg) imgId = newImg.id;
                }
            }
            if (imgId) {
                await supabase.from('item_images').insert({
                    item_id: beerId,
                    image_id: imgId,
                    sort_order: i
                });
            }
        }
    }
    
    // Insert categories/tags
    if (data.selectedCategories && data.selectedCategories.length > 0) {
        for (const catId of data.selectedCategories) {
            await supabase
                .from('item_categories')
                .upsert({
                    item_id: beerId,
                    category_id: catId,
                    is_primary: true
                }, { onConflict: 'item_id,category_id' });
        }
    }
    
    // Delete the draft from the drafts table
    await supabase.from('drafts').delete().eq('id', draft.id);
    
    return beerId;
}

/**
 * Publishes a draft wine, returning the new published items table ID.
 */
export async function resolveWineId(id: string, drafts: any[]): Promise<string> {
    const draft = drafts.find(d => d.id === id);
    if (!draft || draft.entity_type !== 'wine') {
        return id;
    }
    
    const data = draft.draft_data;
    
    const { data: wine, error: wineError } = await supabase
        .from('items')
        .insert({
            item_type: 'wine',
            name: capitalize(data.name) || "Untitled Wine",
            description: data.description?.trim() || null,
            brand_maker: capitalize(data.vintner) || null,
            abv: data.abv ? parseFloat(data.abv) : null,
            price: data.price ? parseFloat(data.price) : null,
            bar_id: data.barId || null,
            override_visibility_level: data.overrideVisibility ? parseInt(data.overrideVisibility) : null,
            override_generic_ingredient_level: data.overrideGeneric ? parseInt(data.overrideGeneric) : null,
            override_specific_brand_level: data.overrideSpecific ? parseInt(data.overrideSpecific) : null,
            override_measurement_level: data.overrideMeasurement ? parseInt(data.overrideMeasurement) : null,
            override_prep_level: data.overridePrep ? parseInt(data.overridePrep) : null,
        })
        .select()
        .single();
        
    if (wineError || !wine) throw wineError;
    
    const wineId = wine.id;
    
    // Handle Images
    if (data.localImages && data.localImages.length > 0) {
        for (let i = 0; i < data.localImages.length; i++) {
            const img = data.localImages[i];
            let imgId = img.id;
            if (!imgId && img.url) {
                const { data: existingImg } = await supabase
                    .from('images')
                    .select('id')
                    .eq('url', img.url)
                    .maybeSingle();
                if (existingImg) {
                    imgId = existingImg.id;
                } else {
                    const { data: newImg } = await supabase
                        .from('images')
                        .insert({ url: img.url })
                        .select()
                        .single();
                    if (newImg) imgId = newImg.id;
                }
            }
            if (imgId) {
                await supabase.from('item_images').insert({
                    item_id: wineId,
                    image_id: imgId,
                    sort_order: i
                });
            }
        }
    }
    
    // Insert categories/tags
    if (data.selectedCategories && data.selectedCategories.length > 0) {
        for (const catId of data.selectedCategories) {
            await supabase
                .from('item_categories')
                .upsert({
                    item_id: wineId,
                    category_id: catId,
                    is_primary: true
                }, { onConflict: 'item_id,category_id' });
        }
    }
    
    // Delete the draft from the drafts table
    await supabase.from('drafts').delete().eq('id', draft.id);
    
    return wineId;
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

