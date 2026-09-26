import { sortRecipesByOrder } from '@/lib/recipeUtils';
import { supabase } from '@/lib/supabase';

/**
 * Raw recipe rows for an item the caller may edit (the recipes table is only
 * readable by editors). Editors save every field of every row, so they load
 * these instead of app_recipe_presentation, which masks fields by role.
 */
export async function fetchEditableRecipes(itemId: string) {
    const { data, error } = await supabase
        .from('recipes')
        .select(`
            id,
            sort_order,
            created_at,
            ingredient_item_id,
            amount,
            unit,
            preparation_notes,
            is_optional,
            ingredient:items!ingredient_item_id (
                id,
                name,
                item_images (
                    images (
                        url
                    )
                )
            )
        `)
        .eq('recipe_item_id', itemId);

    if (error) throw error;
    return sortRecipesByOrder(data ?? []);
}
