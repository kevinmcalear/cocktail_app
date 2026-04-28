import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

export function useDropdowns() {
    return useQuery({
        queryKey: ['dropdowns_v2'],
        queryFn: async () => {
            const [itemsRes, menusRes, templatesRes, sectionsRes, categoriesRes] = await Promise.all([
                supabase.from('app_item_presentation').select('*').in('item_type', ['method', 'glassware', 'family', 'ice', 'ingredient']).order('name'),
                supabase.from('menus').select('id, name, template_id, created_at').eq('is_active', true).order('created_at'),
                supabase.from('menu_templates').select('*').order('name'),
                supabase.from('template_sections').select('*').order('sort_order'),
                supabase.from('categories').select('*').order('name')
            ]);
            
            const items = itemsRes.data || [];

            return {
                methods: items.filter(item => item.item_type === 'method'),
                glassware: items.filter(item => item.item_type === 'glassware'),
                families: items.filter(item => item.item_type === 'family'),
                iceTypes: items.filter(item => item.item_type === 'ice'),
                ingredients: items.filter(item => item.item_type === 'ingredient'),
                menus: menusRes.data || [],
                menuTemplates: templatesRes.data || [],
                templateSections: sectionsRes.data || [],
                categories: categoriesRes.data || [],
            };
        },
        // We can cache these for a long time since they change rarely
        staleTime: 1000 * 60 * 60, // 1 hour
    });
}
