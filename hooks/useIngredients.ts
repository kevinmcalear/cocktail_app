import { supabase } from '@/lib/supabase';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// Standard ingredient list query
export function useIngredients() {
    return useQuery({
        queryKey: ['ingredients'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('ingredients')
                .select(`
                    *,
                    ingredient_images (
                        images ( url )
                    )
                `)
                .order('name');
                
            if (error) throw error;
            return data;
        }
    });
}

// Single ingredient detail query, including where it's used
export function useIngredient(id?: string | string[]) {
    return useQuery({
        queryKey: ['ingredient', id],
        queryFn: async () => {
            if (!id) return null;
            const ingredientId = Array.isArray(id) ? id[0] : id;

            // 1. Fetch Ingredient Info
            const { data: ingredient, error: ingError } = await supabase
                .from('ingredients')
                .select(`
                    *,
                    ingredient_images (
                        images ( url )
                    )
                `)
                .eq('id', ingredientId)
                .single();

            if (ingError) throw ingError;

            // 2. Fetch Recipe (sub-ingredients)
            const { data: recipe, error: recipeError } = await supabase
                .from('recipes')
                .select(`
                    id,
                    ingredient_id,
                    ingredient_bsp,
                    ingredient_ml,
                    ingredient_dash,
                    ingredient_amount,
                    is_top,
                    ingredient:ingredients!recipes_ingredient_id_fkey(name)
                `)
                .eq('parent_ingredient_id', ingredientId);

            if (recipeError) throw recipeError;

            // 3. Fetch cocktails that use this ingredient
            const { data: usedInData, error: usedInError } = await supabase
                .from('recipes')
                .select(`
                    id,
                    cocktail:cocktails(
                        id, 
                        name,
                        cocktail_images (
                            images ( url )
                        )
                    )
                `)
                .eq('ingredient_id', ingredientId)
                .not('cocktail', 'is', null);

            let usedIn: any[] = [];
            if (!usedInError && usedInData) {
                const uniqueCocktails = new Map();
                usedInData.forEach((item: any) => {
                    if (item.cocktail && !uniqueCocktails.has(item.cocktail.id)) {
                        uniqueCocktails.set(item.cocktail.id, item);
                    }
                });
                usedIn = Array.from(uniqueCocktails.values());
            }

            return {
                ingredient,
                recipe: recipe || [],
                usedIn
            };
        },
        enabled: !!id,
    });
}

export const updateIngredientFn = async ({ id, updates }: { id: string, updates: any }) => {
    const { data, error } = await supabase
        .from('ingredients')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
        
    if (error) throw error;
    return data;
};

export const addIngredientFn = async (newIngredient: any) => {
    const { data, error } = await supabase
        .from('ingredients')
        .insert(newIngredient)
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
