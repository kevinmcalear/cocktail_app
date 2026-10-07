import { useViewAs } from '@/hooks/useViewAs';
import { supabase } from '@/lib/supabase';
import { resolvePresentationIngredient, sortRecipesByOrder } from '@/lib/recipeUtils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { applyBarContextFilter } from '@/lib/barContextFilter';
import { batchedDrinkName, nameKey, orderedPictures, withDrinkPhotos, type ItemImageLink } from '@/lib/itemImages';
import { useAppStore } from '@/store/useAppStore';

// Standard ingredient list query
export function useIngredients(options?: { allContexts?: boolean }) {
    const selectedContextIds = useAppStore((state) => state.selectedContextIds);
    const { viewAsRoleLevel } = useViewAs();

    return useQuery({
        queryKey: ['ingredients', selectedContextIds, options, viewAsRoleLevel],
        queryFn: async () => {
            let query = supabase
                .from('app_item_presentation')
                .select(`
                    *,
                    item_images (
                        sort_order,
                        image_id,
                        is_generated,
                        outdated_since,
                        images ( id, url, palette )
                    ),
                    item_categories (
                        category_id
                    )
                `)
                .eq('item_type', 'ingredient');

            if (!options?.allContexts) {
                query = applyBarContextFilter(query, selectedContextIds);
            }

            const { data, error } = await query.order('name');
                
            if (error) throw error;
            return data;
        }
    });
}

/**
 * The photos of the drink a batch makes ("Aperol Fizz" for "Aperol Fizz Batch"),
 * from the same venue. Null when it isn't a batch, or already has a photo.
 */
async function batchDrinkImages(item: { name: string; bar_id: string | null; item_images?: ItemImageLink[] | null }) {
    const drink = batchedDrinkName(item.name);
    if (!drink || orderedPictures(item.item_images).some((p) => !p.isSketch)) return null;
    let query = supabase
        .from('app_item_presentation')
        .select('name, item_images ( angle, sort_order, is_generated, images ( url ) )')
        .eq('item_type', 'cocktail')
        .ilike('name', drink.replace(/[\\%_]/g, '\\$&'));
    query = item.bar_id ? query.eq('bar_id', item.bar_id) : query.is('bar_id', null);
    // A missing photo is not worth failing the page over.
    const { data } = await query.limit(5);
    return (data ?? []).find((d) => nameKey(d.name ?? '') === nameKey(drink))?.item_images as ItemImageLink[] | null ?? null;
}

// Single ingredient detail query, including where it's used
export function useIngredient(id?: string | string[]) {
    const { viewAsRoleLevel } = useViewAs();
    return useQuery({
        queryKey: ['ingredient', id, viewAsRoleLevel],
        queryFn: async () => {
            if (!id) return null;
            const ingredientId = Array.isArray(id) ? id[0] : id;

            // 1. Fetch Ingredient Info
            const { data: ingredient, error: ingError } = await supabase
                .from('app_item_presentation')
                .select(`
                    *,
                    item_images (
                        sort_order,
                        image_id,
                        is_generated,
                        outdated_since,
                        images ( id, url, palette )
                    )
                `)
                .eq('id', ingredientId)
                .single();

            if (ingError) throw ingError;

            // What it's a kind of. A second read: the self-referencing key is
            // ambiguous to embed through the view.
            const generic = ingredient.generic_id
                ? (await supabase.from('app_item_presentation').select('id, name').eq('id', ingredient.generic_id).maybeSingle()).data
                : null;

            // 2. Fetch Recipe (sub-ingredients)
            const { data: rawRecipe, error: recipeError } = await supabase
                .from('app_recipe_presentation')
                .select(`
                    id,
                    sort_order,
                    created_at,
                    display_ingredient_id,
                    amount,
                    unit,
                    preparation_notes,
                    is_optional,
                    display_ingredient(id, name)
                `)
                .eq('recipe_item_id', ingredientId);

            if (recipeError) throw recipeError;

            const recipe = sortRecipesByOrder(rawRecipe)?.map((r: any) => ({
                ...r,
                ingredient: resolvePresentationIngredient(r),
            }));

            // 3. Fetch cocktails that use this ingredient
            const { data: usedInData, error: usedInError } = await supabase
                .from('app_recipe_presentation')
                .select(`
                    id,
                    cocktail:app_item_presentation!new_recipes_recipe_item_id_fkey(
                        id, 
                        name,
                        item_type,
                        item_images (
                            sort_order,
                            is_generated,
                            images ( url )
                        )
                    )
                `)
                .eq('display_ingredient_id', ingredientId)
                .not('cocktail', 'is', null);

            let usedIn: any[] = [];
            if (!usedInError && usedInData) {
                const uniqueCocktails = new Map();
                usedInData.forEach((item: any) => {
                    // Preps this goes into are listed on the prep card, not here.
                    if (item.cocktail?.item_type === 'cocktail' && !uniqueCocktails.has(item.cocktail.id)) {
                        uniqueCocktails.set(item.cocktail.id, item);
                    }
                });
                usedIn = Array.from(uniqueCocktails.values());
            }

            return {
                ingredient: { ...ingredient, generic },
                // Shown in place of a batch's sketch; kept apart so the edit screen never saves them.
                heroImages: withDrinkPhotos(ingredient.item_images, await batchDrinkImages(ingredient)),
                recipe: recipe || [],
                usedIn
            };
        },
        enabled: !!id,
    });
}

export const updateIngredientFn = async ({ id, updates }: { id: string, updates: any }) => {
    const { data, error } = await supabase
        .from('items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
        
    if (error) throw error;
    return data;
};

export const addIngredientFn = async (newIngredient: any) => {
    const { data, error } = await supabase
        .from('items')
        .insert({ ...newIngredient, item_type: 'ingredient' })
        .select()
        .single();
        
    if (error) throw error;
    return data;
};

// Mutations
export function useUpdateIngredient() {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationKey: ['updateIngredient'],
        mutationFn: updateIngredientFn,
        onMutate: async (newVariables) => {
            await queryClient.cancelQueries({ queryKey: ['ingredients'] });
            await queryClient.cancelQueries({ queryKey: ['ingredient', newVariables.id] });

            const previousIngredients = queryClient.getQueryData(['ingredients']);
            const previousIngredient = queryClient.getQueryData(['ingredient', newVariables.id]);

            queryClient.setQueryData(['ingredients'], (old: any) => 
                old ? old.map((i: any) => i.id === newVariables.id ? { ...i, ...newVariables.updates } : i) : old
            );
            
            // To optimistically update the individual ingredient query, we must match its shape
            queryClient.setQueryData(['ingredient', newVariables.id], (old: any) => {
                if (!old) return old;
                return {
                   ...old,
                   ingredient: { ...old.ingredient, ...newVariables.updates }
                };
            });

            return { previousIngredients, previousIngredient, id: newVariables.id };
        },
        onError: (err, newVariables, context) => {
            if (context?.previousIngredients) {
                queryClient.setQueryData(['ingredients'], context.previousIngredients);
            }
            if (context?.previousIngredient) {
                queryClient.setQueryData(['ingredient', context.id], context.previousIngredient);
            } else {
                queryClient.invalidateQueries({ queryKey: ['ingredients'] });
                queryClient.invalidateQueries({ queryKey: ['ingredient', newVariables.id] });
            }
        },
        onSettled: (data, error, variables) => {
            queryClient.invalidateQueries({ queryKey: ['ingredient', variables.id] });
            queryClient.invalidateQueries({ queryKey: ['ingredients'] });
        }
    });
}

export function useAddIngredient() {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationKey: ['addIngredient'],
        mutationFn: addIngredientFn,
        onMutate: async (newIngredient) => {
            await queryClient.cancelQueries({ queryKey: ['ingredients'] });
            const previousIngredients = queryClient.getQueryData(['ingredients']);
            
            queryClient.setQueryData(['ingredients'], (old: any) => 
                old ? [...old, { ...newIngredient, id: 'temp-id-' + Date.now() }] : old
            );
            
            return { previousIngredients };
        },
        onError: (err, newVariables, context) => {
            if (context?.previousIngredients) {
                queryClient.setQueryData(['ingredients'], context.previousIngredients);
            } else {
                queryClient.invalidateQueries({ queryKey: ['ingredients'] });
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['ingredients'] });
        }
    });
}
