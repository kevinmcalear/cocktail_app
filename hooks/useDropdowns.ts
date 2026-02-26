import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

export function useDropdowns() {
    return useQuery({
        queryKey: ['dropdowns'],
        queryFn: async () => {
            const [methodsRes, glasswareRes, familiesRes, iceRes, menusRes, ingredientsRes, templatesRes, sectionsRes] = await Promise.all([
                supabase.from('methods').select('*').order('name'),
                supabase.from('glassware').select('*').order('name'),
                supabase.from('families').select('*').order('name'),
                supabase.from('ice').select('*').order('name'),
                supabase.from('menus').select('id, name, template_id, created_at').eq('is_active', true).order('created_at'),
                supabase.from('ingredients').select('*').order('name'),
                supabase.from('menu_templates').select('*').order('name'),
                supabase.from('template_sections').select('*').order('sort_order')
            ]);

            return {
                methods: methodsRes.data || [],
                glassware: glasswareRes.data || [],
                families: familiesRes.data || [],
                iceTypes: iceRes.data || [],
                menus: menusRes.data || [],
                ingredients: ingredientsRes.data || [],
                menuTemplates: templatesRes.data || [],
                templateSections: sectionsRes.data || [],
            };
        },
        // We can cache these for a long time since they change rarely
        staleTime: 1000 * 60 * 60, // 1 hour
    });
}
