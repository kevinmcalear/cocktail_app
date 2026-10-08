import { useAuth } from '@/ctx/AuthContext';
import { useViewAs } from '@/hooks/useViewAs';
import { allRows } from '@/lib/allRows';
import { supabase } from '@/lib/supabase';
import { resolvePresentationIngredient, sortRecipesByOrder } from '@/lib/recipeUtils';
import { DatabaseItem } from '@/types/types';
import { QueryClientContext, queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useContext } from 'react';
import { applyBarContextFilter } from '@/lib/barContextFilter';
import { useAppStore } from '@/store/useAppStore';

/**
 * Columns for a drink list or search card (app_item_presentation). The lines
 * (with their notes) stay for Library's ingredient search and Study's card
 * backs; photo colours (palette) are only for the drink page, which reads its own.
 */
export const COCKTAIL_LIST_COLUMNS = `
    id,
    name,
    description,
    bar_id,
    glassware_id,
    family_id,
    ice_id,
    item_methods!item_methods_item_id_fkey (
        method_item_id,
        sort_order
    ),
    recipes:app_recipe_presentation!recipe_item_id (
        sort_order,
        created_at,
        display_ingredient_id,
        amount,
        unit,
        preparation_notes,
        display_ingredient (
            id,
            name,
            item_categories (
                category_id
            )
        )
    ),
    item_images (
        id,
        angle,
        sort_order,
        image_id,
        is_generated,
        outdated_since,
        images (
            id,
            url
        )
    ),
    item_categories (
        category_id
    )
`;

/** Maps the secure recipes payload to the shapes the UI expects. */
type ListRecipe = { sort_order?: number | null; created_at?: string; display_ingredient_id?: string | null };

export function withListRecipes(data: { recipes?: ListRecipe[] | null }[] | null): DatabaseItem[] {
    const processed = data?.map((cocktail) => ({
        ...cocktail,
        recipes: sortRecipesByOrder(
            cocktail.recipes?.map((recipe) => ({
                ...recipe,
                ingredient: resolvePresentationIngredient(recipe),
            }))
        ),
    }));
    return (processed ?? []) as unknown as DatabaseItem[];
}

export function useCocktails(options?: { allContexts?: boolean }) {
    const selectedContextIds = useAppStore((state) => state.selectedContextIds);
    const { viewAsRoleLevel } = useViewAs();
    const userId = useAuth().user?.id ?? null;

    return useQuery({
        queryKey: ['cocktails', selectedContextIds, options, viewAsRoleLevel, userId],
        queryFn: async () => {
            const data = await allRows((from, to) => {
                let query = supabase
                    .from('app_item_presentation')
                    .select(COCKTAIL_LIST_COLUMNS)
                    .eq('item_type', 'cocktail')
                    // Drinks credited to another bar or person with no venue behind them (a
                    // bar's signatures, a bartender's originals) stay on that public profile,
                    // out of the Library. Search lists them apart, under "From bars" (usePublicDrinks).
                    .or(`bar_id.not.is.null,and(origin_bar_profile_id.is.null,creator_profile_id.is.null)${userId ? `,created_by.eq.${userId}` : ''}`);

                if (!options?.allContexts) {
                    query = applyBarContextFilter(query, selectedContextIds);
                }

                return query.order('name', { ascending: true }).order('id').range(from, to);
            });

            return withListRecipes(data);
        }
    });
}

/** The drink page's query, shared by the page and a row's press-in prefetch (usePrefetchCocktail). */
export function cocktailQuery(id: string | string[] | undefined, viewAsRoleLevel: ReturnType<typeof useViewAs>['viewAsRoleLevel']) {
    return queryOptions({
        queryKey: ['cocktail', id, viewAsRoleLevel],
        queryFn: async () => {
            if (!id) return null;
            
            const cocktailId = Array.isArray(id) ? id[0] : id;

            const { data, error } = await supabase
                .from('app_item_presentation')
                .select(`
                    *,
                    item_images (
                        id,
                        angle,
                        sort_order,
                        is_generated,
                        outdated_since,
                        images (
                            url,
                            id,
                            palette,
                            credit,
                            source_url
                        )
                    ),
                    recipes:app_recipe_presentation!recipe_item_id (
                        id,
                        sort_order,
                        created_at,
                        amount,
                        unit,
                        preparation_notes,
                        at_service,
                        display_ingredient_id,
                        display_ingredient (
                            id,
                            name,
                            abv,
                            item_images (
                                angle,
                                sort_order,
                                is_generated,
                                images (
                                    url
                                )
                            )
                        )
                    ),
                    item_methods!item_methods_item_id_fkey (
                        method_item_id,
                        sort_order,
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
                data.recipes = sortRecipesByOrder(
                    data.recipes?.map((recipe: any) => ({
                        ...recipe,
                        ingredient: resolvePresentationIngredient(recipe),
                    }))
                );

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

export function useCocktail(id?: string | string[]) {
    const { viewAsRoleLevel } = useViewAs();
    return useQuery(cocktailQuery(id, viewAsRoleLevel));
}

/**
 * Starts loading a drink page as its row is pressed, so the page has a head
 * start on the tap (the press-to-release gap is often 100 ms or more). A
 * page loaded in the last minute isn't asked for again.
 */
export function usePrefetchCocktail() {
    // From context, not useQueryClient: a row rendered with no provider (a test) just doesn't prefetch.
    const client = useContext(QueryClientContext);
    return (id: string) => {
        if (!client) return;
        // The view-as level the page will key on (useViewAs), as it's cached.
        const level = client.getQueriesData<number | null>({ queryKey: ['viewAs'] })[0]?.[1] ?? null;
        void client.prefetchQuery({ ...cocktailQuery(id, level), staleTime: 60 * 1000 });
    };
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
    const { data, error } = await supabase
        .from('items')
        .delete()
        .eq('id', id)
        .select('id');

    if (error) throw error;
    // RLS turns a delete you can't make into "0 rows", not an error.
    if (!data?.length) throw new Error("You don't have permission to delete this drink.");
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
        onSuccess: (_data, id) => {
             queryClient.removeQueries({ queryKey: ['cocktail', id] });
        },
        onSettled: () => {
             queryClient.invalidateQueries({ queryKey: ['menu-library'] });
             queryClient.invalidateQueries({ queryKey: ['cocktails'] });
        }
    });
}
