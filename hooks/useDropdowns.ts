import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

export function useDropdowns() {
    return useQuery({
        queryKey: ['dropdowns'],
        queryFn: async () => {
            const [methodsRes, glasswareRes, familiesRes, iceRes, menusRes, ingredientsRes] = await Promise.all([
                supabase.from('methods').select('*').order('name'),
                supabase.from('glassware').select('*').order('name'),
                supabase.from('families').select('*').order('name'),
                supabase.from('ice').select('*').order('name'),
                supabase.from('menus').select('id, name').eq('is_active', true).order('name'),
                supabase.from('ingredients').select('*').order('name')
            ]);

            return {
                methods: methodsRes.data || [],
                glassware: glasswareRes.data || [],
                families: familiesRes.data || [],
                iceTypes: iceRes.data || [],
                menus: menusRes.data || [],
                ingredients: ingredientsRes.data || [],
            };
        },
        // We can cache these for a long time since they change rarely
        staleTime: 1000 * 60 * 60, // 1 hour
    });
}
