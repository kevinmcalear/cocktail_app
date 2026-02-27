import { supabase } from '@/lib/supabase';
import { DatabaseCocktail } from '@/types/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useCocktails() {
    return useQuery({
        queryKey: ['cocktails'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('cocktails')
                .select(`
                    id,
                    name,
                    description,
                    recipes (
                        ingredient_ml,
                        ingredient_bsp,
                        ingredient_dash,
                        ingredient_amount,
                        is_top,
                        ingredients!recipes_ingredient_id_fkey (
                            name
                        )
                    ),
                    cocktail_images (
                        images (
                            url
                        )
                    )
                `)
                .order('name', { ascending: true });

            if (error) throw error;
            return data;
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
                .from('cocktails')
                .select(`
                    *,
                    cocktail_images (
                        images (
                            url,
                            id
                        )
                    ),
                    recipes (
                        id,
                        ingredient_bsp,
                        ingredient_ml,
                        ingredient_dash,
                        ingredient_amount,
                        is_top,
                        ingredients!recipes_ingredient_id_fkey (
                            name,
                            ingredient_images (
                                images (
                                    url
                                )
                            )
                        )
                    ),
                    methods ( name ),
                    glassware ( name ),
                    families ( name ),
                    ice ( name )
                `)
                .eq('id', cocktailId)
                .single();

            if (error) throw error;
            return data as DatabaseCocktail;
        },
        enabled: !!id,
    });
}

export const updateCocktailFn = async ({ id, updates }: { id: string, updates: any }) => {
    const { data, error } = await supabase
        .from('cocktails')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
        
    if (error) throw error;
    return data;
};

export const deleteCocktailFn = async (id: string) => {
    const { error } = await supabase
        .from('cocktails')
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
