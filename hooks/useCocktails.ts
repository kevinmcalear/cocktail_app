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
                            name
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

// Additional mutations (add, update, delete) can be added here
export function useUpdateCocktail() {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: async ({ id, updates }: { id: string, updates: any }) => {
            const { data, error } = await supabase
                .from('cocktails')
                .update(updates)
                .eq('id', id)
                .select()
                .single();
                
            if (error) throw error;
            return data;
        },
        onSuccess: (data, variables) => {
            // Invalidate the specific cocktail query and the list
            queryClient.invalidateQueries({ queryKey: ['cocktail', variables.id] });
            queryClient.invalidateQueries({ queryKey: ['cocktails'] });
        }
    });
}

export function useDeleteCocktail() {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('cocktails')
                .delete()
                .eq('id', id);
                
            if (error) throw error;
        },
        onSuccess: () => {
             queryClient.invalidateQueries({ queryKey: ['cocktails'] });
        }
    });
}
