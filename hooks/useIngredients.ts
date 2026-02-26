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

// Mutations
export function useUpdateIngredient() {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: async ({ id, updates }: { id: string, updates: any }) => {
            const { data, error } = await supabase
                .from('ingredients')
                .update(updates)
                .eq('id', id)
                .select()
                .single();
                
            if (error) throw error;
            return data;
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['ingredient', variables.id] });
            queryClient.invalidateQueries({ queryKey: ['ingredients'] });
        }
    });
}

export function useAddIngredient() {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: async (newIngredient: any) => {
            const { data, error } = await supabase
                .from('ingredients')
                .insert(newIngredient)
                .select()
                .single();
                
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ingredients'] });
        }
    });
}
