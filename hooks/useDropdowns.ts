import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

export function useDropdowns() {
    return useQuery({
        queryKey: ['dropdowns_v3'],
        queryFn: async () => {
            const menusQuery = async () => {
                const res = await supabase
                    .from('menus')
                    .select('id, name, template_id, bar_id, created_at, cover_url')
                    .eq('is_active', true)
                    .order('created_at');
                if (res.error) {
                    console.warn("Failed to fetch menus with cover_url/bar_id, attempting fallback:", res.error.message);
                    const withBar = await supabase
                        .from('menus')
                        .select('id, name, template_id, bar_id, created_at')
                        .eq('is_active', true)
                        .order('created_at');
                    if (!withBar.error) {
                        return (withBar.data || []).map((m) => ({ ...m, cover_url: null }));
                    }
                    const fallbackRes = await supabase
                        .from('menus')
                        .select('id, name, template_id, created_at')
                        .eq('is_active', true)
                        .order('created_at');
                    if (fallbackRes.error) throw fallbackRes.error;
                    return (fallbackRes.data || []).map((m) => ({ ...m, bar_id: null, cover_url: null }));
                }
                return res.data || [];
            };

            const [itemsRes, menusData, templatesRes, sectionsRes, categoriesRes] = await Promise.all([
                supabase.from('app_item_presentation').select('*, item_images(images(url))').in('item_type', ['method', 'glassware', 'family', 'ice', 'ingredient']).order('name'),
                menusQuery(),
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
                menus: menusData,
                menuTemplates: templatesRes.data || [],
                templateSections: sectionsRes.data || [],
                categories: categoriesRes.data || [],
            };
        },
        // We can cache these for a long time since they change rarely
        staleTime: 1000 * 60 * 60, // 1 hour
    });
}
