import { supabase } from '@/lib/supabase';
import { DatabaseItem } from '@/types/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/useAppStore';

export function useCocktails(options?: { globalOnly?: boolean; allContexts?: boolean }) {
    const selectedBarId = useAppStore(state => state.selectedBarId);

    return useQuery({
        queryKey: ['cocktails', selectedBarId, options],
        queryFn: async () => {
            let query = supabase
                .from('app_item_presentation')
                .select(`
                    id,
                    name,
                    description,
                    glassware_id,
                    family_id,
                    recipes:app_recipe_presentation!recipe_item_id (
                        display_ingredient_id,
                        ingredient_item_id,
                        parent_ingredient_id,
                        amount,
                        unit,
                        preparation_notes,
                        specific_ingredient:items!ingredient_item_id (
                            id,
                            name,
                            item_categories (
                                category_id
                            )
                        ),
                        generic_ingredient:items!parent_ingredient_id (
                            id,
                            name,
                            item_categories (
                                category_id
                            )
                        )
                    ),
                    item_images (
                        sort_order,
                        image_id,
                        images (
                            id,
                            url
                        )
                    ),
                    item_categories (
                        category_id
                    )
                `)
                .eq('item_type', 'cocktail');

            if (options?.allContexts) {
                // Do not filter by bar_id, fetch everything user has access to
            } else if (options?.globalOnly) {
                query = query.is('bar_id', null);
            } else if (selectedBarId) {
                query = query.eq('bar_id', selectedBarId);
            } else {
                query = query.is('bar_id', null);
            }

            const { data, error } = await query.order('name', { ascending: true });

            if (error) throw error;
            
            // Map the secure recipes payload to match the expected UI shapes
            const processedData = data?.map(cocktail => ({
                ...cocktail,
                recipes: cocktail.recipes?.map((recipe: any) => {
                    const ingredient = !recipe.display_ingredient_id 
                        ? null 
                        : recipe.display_ingredient_id === recipe.parent_ingredient_id 
                            ? recipe.generic_ingredient 
                            : recipe.specific_ingredient;
                    
                    return {
                        ...recipe,
                        ingredient: ingredient ? { ...ingredient, id: ingredient.id || recipe.display_ingredient_id || recipe.ingredient_item_id } : null
                    };
                })
            }));

            return processedData as unknown as DatabaseItem[];
        }
    });
}

export function useCocktail(id?: string | string[]) {
    return useQuery({
        queryKey: ['cocktail', id],
        queryFn: async () => {
            if (!id) return null;
            
            const cocktailId = Array.isArray(id) ? id[0] : id;

            const { data, error } = await supabase
                .from('app_item_presentation')
                .select(`
                    *,
                    item_images (
                        images (
                            url,
                            id
                        )
                    ),
                    recipes:app_recipe_presentation!recipe_item_id (
                        id,
                        amount,
                        unit,
                        preparation_notes,
                        display_ingredient_id,
                        ingredient_item_id,
                        parent_ingredient_id,
                        specific_ingredient:items!ingredient_item_id (
                            id,
                            name,
                            item_images (
                                images (
                                    url
                                )
                            )
                        ),
                        generic_ingredient:items!parent_ingredient_id (
                            id,
                            name,
                            item_images (
                                images (
                                    url
                                )
                            )
                        )
                    ),
                    item_methods!item_methods_item_id_fkey (
                        method_item_id,
                        method:items!item_methods_method_item_id_fkey (
                            name
                        )
                    )
                `)
                .eq('id', cocktailId)
                .single();

            if (error) throw error;
            
            if (data) {
                // Map the secure recipes payload to match the expected UI shapes
                data.recipes = data.recipes?.map((recipe: any) => {
                    const ingredient = !recipe.display_ingredient_id 
                        ? null 
                        : recipe.display_ingredient_id === recipe.parent_ingredient_id 
                            ? recipe.generic_ingredient 
                            : recipe.specific_ingredient;

                    return {
                        ...recipe,
                        ingredient: ingredient ? { ...ingredient, id: ingredient.id || recipe.display_ingredient_id || recipe.ingredient_item_id } : null
                    };
                });

                // Fetch glassware, family, and ice manually to bypass PostgREST ambiguous relation errors on views
                const idsToFetch = [data.glassware_id, data.family_id, data.ice_id].filter(Boolean);
                if (idsToFetch.length > 0) {
                    const { data: relatedItems } = await supabase.from('items').select('id, name').in('id', idsToFetch);
                    if (relatedItems) {
                        if (data.glassware_id) data.glassware = relatedItems.find(i => i.id === data.glassware_id);
                        if (data.family_id) data.family = relatedItems.find(i => i.id === data.family_id);
                        if (data.ice_id) data.ice = relatedItems.find(i => i.id === data.ice_id);
                    }
                }
            }

            return data as DatabaseItem;
        },
        enabled: !!id,
    });
}

export const updateCocktailFn = async ({ id, updates }: { id: string, updates: Partial<DatabaseItem> }) => {
    const { data, error } = await supabase
        .from('items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
        
    if (error) throw error;
    return data;
};

export const deleteCocktailFn = async (id: string) => {
    const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', id);
        
    if (error) throw error;
};

// Additional mutations (add, update, delete) can be added here
export function useUpdateCocktail() {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationKey: ['updateCocktail'],
        mutationFn: updateCocktailFn,
        onMutate: async (newVariables) => {
            // Cancel any outgoing refetches so they don't overwrite our optimistic update
            await queryClient.cancelQueries({ queryKey: ['cocktails'] });
            await queryClient.cancelQueries({ queryKey: ['cocktail', newVariables.id] });

            // Snapshot the previous value
            const previousCocktails = queryClient.getQueryData(['cocktails']);
            const previousCocktail = queryClient.getQueryData(['cocktail', newVariables.id]);

            // Optimistically update to the new value
            queryClient.setQueryData(['cocktails'], (old: any) => 
                old ? old.map((c: any) => c.id === newVariables.id ? { ...c, ...newVariables.updates } : c) : old
            );
            queryClient.setQueryData(['cocktail', newVariables.id], (old: any) =>
                old ? { ...old, ...newVariables.updates } : old
            );

            // Return a context object with the snapshotted value
            return { previousCocktails, previousCocktail, id: newVariables.id };
        },
        onError: (err, newVariables, context) => {
            // If the mutation fails, use the context returned from onMutate to roll back
            if (context?.previousCocktails) {
                queryClient.setQueryData(['cocktails'], context.previousCocktails);
            }
            if (context?.previousCocktail) {
                queryClient.setQueryData(['cocktail', context.id], context.previousCocktail);
            } else {
                // If context is gone (e.g. app restarted), invalidate to get real server data
                queryClient.invalidateQueries({ queryKey: ['cocktails'] });
                queryClient.invalidateQueries({ queryKey: ['cocktail', newVariables.id] });
            }
        },
        onSettled: (data, error, variables) => {
            // Always refetch after error or success to ensure sync
            queryClient.invalidateQueries({ queryKey: ['cocktail', variables.id] });
            queryClient.invalidateQueries({ queryKey: ['cocktails'] });
        }
    });
}

export function useDeleteCocktail() {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationKey: ['deleteCocktail'],
        mutationFn: deleteCocktailFn,
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: ['cocktails'] });
            const previousCocktails = queryClient.getQueryData(['cocktails']);
            
            queryClient.setQueryData(['cocktails'], (old: any) => 
                old ? old.filter((c: any) => c.id !== id) : old
            );
            
            return { previousCocktails, id };
        },
        onError: (err, newVariables, context) => {
            if (context?.previousCocktails) {
                queryClient.setQueryData(['cocktails'], context.previousCocktails);
            } else {
                queryClient.invalidateQueries({ queryKey: ['cocktails'] });
            }
        },
        onSettled: () => {
             queryClient.invalidateQueries({ queryKey: ['cocktails'] });
        }
    });
}
