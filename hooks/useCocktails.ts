import { useAuth } from '@/ctx/AuthContext';
import { dropdownKeys } from '@/hooks/useDropdowns';
import { useViewAs } from '@/hooks/useViewAs';
import { allRowsById, byName } from '@/lib/allRows';
import { supabase } from '@/lib/supabase';
import { resolvePresentationIngredient, sortRecipesByOrder } from '@/lib/recipeUtils';
import { DatabaseItem } from '@/types/types';
import { QueryClientContext, queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useContext } from 'react';
import { applyBarContextFilter } from '@/lib/barContextFilter';
import { drinkSeed, seedDrink, type DrinkSeed } from '@/lib/drinkSeeds';
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
    // Every venue's list ignores the picked venues, so switching venue doesn't download it again.
    const contexts = options?.allContexts ? null : selectedContextIds;

    return useQuery({
        queryKey: ['cocktails', contexts, options, viewAsRoleLevel, userId],
        queryFn: async () => {
            // By id, a page after the last id (an offset page re-sorts every row before it), then into name order here.
            const data = await allRowsById((after, size) => {
                let query = supabase
                    .from('app_item_presentation')
                    .select(COCKTAIL_LIST_COLUMNS)
                    .eq('item_type', 'cocktail')
                    // Drinks credited to another bar or person with no venue behind them (a
                    // bar's signatures, a bartender's originals) stay on that public profile,
                    // out of the Library. Search lists them apart, under "From bars".
                    .or(`bar_id.not.is.null,and(origin_bar_profile_id.is.null,creator_profile_id.is.null)${userId ? `,created_by.eq.${userId}` : ''}`);

                if (contexts) query = applyBarContextFilter(query, contexts);
                if (after) query = query.gt('id', after);

                return query.order('id').limit(size);
            });

            return withListRecipes(data.sort(byName));
        }
    });
}

/** The drink page's query, shared by the page and a row's press-in prefetch (usePrefetchCocktail). */
export function cocktailQuery(id: string | string[] | undefined, viewAsRoleLevel: ReturnType<typeof useViewAs>['viewAsRoleLevel']) {
    return queryOptions({
        queryKey: ['cocktail', id, viewAsRoleLevel],
        queryFn: async ({ client }) => {
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

                // Glass, family and ice by name for the legacy editor and Start from a classic,
                // from the spec lists already loaded (no second request). The drink page reads
                // the ids against those lists itself (useDrinkFacts).
                type Named = { id: string; name: string };
                const specs = client.getQueryData<Record<'glassware' | 'families' | 'iceTypes', Named[]>>(dropdownKeys.specs);
                const named = (list: Named[] | undefined, itemId: string | null) => {
                    const row = itemId ? list?.find((i) => i.id === itemId) : undefined;
                    return row ? { id: row.id, name: row.name } : undefined;
                };
                data.glassware = named(specs?.glassware, data.glassware_id);
                data.family = named(specs?.families, data.family_id);
                data.ice = named(specs?.iceTypes, data.ice_id);
            }

            return data as DatabaseItem;
        },
        enabled: !!id,
    });
}

/**
 * A drink. `seeded`: the drink page only, whose first paint can come from the
 * row that was tapped (usePrefetchCocktail) as placeholder data, which is
 * never cached, so the editor and Start from a classic never read it.
 */
export function useCocktail(id?: string | string[], { seeded = false }: { seeded?: boolean } = {}) {
    const { viewAsRoleLevel } = useViewAs();
    const seed = seeded ? drinkSeed(Array.isArray(id) ? id[0] : id) : undefined;
    return useQuery({ ...cocktailQuery(id, viewAsRoleLevel), placeholderData: seed as DatabaseItem | undefined });
}

/**
 * Starts loading a drink page as its row is pressed, so the page has a head
 * start on the tap (the press-to-release gap is often 100 ms or more). A
 * page loaded in the last minute isn't asked for again. With the row's name
 * and picture, the page paints those while the rest loads. Every list that
 * opens a drink calls this from onPressIn.
 */
export function usePrefetchCocktail() {
    // From context, not useQueryClient: a row rendered with no provider (a test) just doesn't prefetch.
    const client = useContext(QueryClientContext);
    return (id: string, row?: Omit<DrinkSeed, 'id'>) => {
        if (row) seedDrink({ ...row, id });
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

            // The real keys carry context, role and user after these prefixes, so
            // snapshot and update every matching entry, not one exact key.
            const previousCocktails = queryClient.getQueriesData<DatabaseItem[]>({ queryKey: ['cocktails'] });
            const previousCocktail = queryClient.getQueriesData<DatabaseItem | null>({ queryKey: ['cocktail', newVariables.id] });

            queryClient.setQueriesData<DatabaseItem[]>({ queryKey: ['cocktails'] }, (old) =>
                old?.map((c) => c.id === newVariables.id ? { ...c, ...newVariables.updates } : c)
            );
            queryClient.setQueriesData<DatabaseItem | null>({ queryKey: ['cocktail', newVariables.id] }, (old) =>
                old ? { ...old, ...newVariables.updates } : old
            );

            return { snapshots: [...previousCocktails, ...previousCocktail] };
        },
        onError: (err, newVariables, context) => {
            if (context) {
                for (const [key, data] of context.snapshots) queryClient.setQueryData(key, data);
            }
            // onSettled refetches either way, which also covers a lost context (e.g. app restarted).
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
            const previousCocktails = queryClient.getQueriesData<DatabaseItem[]>({ queryKey: ['cocktails'] });

            queryClient.setQueriesData<DatabaseItem[]>({ queryKey: ['cocktails'] }, (old) =>
                old?.filter((c) => c.id !== id)
            );

            return { previousCocktails };
        },
        onError: (err, id, context) => {
            if (context) {
                for (const [key, data] of context.previousCocktails) queryClient.setQueryData(key, data);
            }
            // onSettled refetches either way, which also covers a lost context.
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
