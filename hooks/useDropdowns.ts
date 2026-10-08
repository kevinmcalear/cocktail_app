import { allRows } from '@/lib/allRows';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

/** Bump when menus shape / current filter changes so hour-long cache can't serve stale rows. */
export const DROPDOWNS_QUERY_KEY = ['dropdowns_v7'] as const;

export function useDropdowns() {
    return useQuery({
        queryKey: DROPDOWNS_QUERY_KEY,
        // Too big to save between launches (lib/queryCachePersist.ts).
        meta: { persist: false },
        queryFn: async () => {
            // ponytail: fetch all menus; Current sidebar filters is_active (inactive stay in creator tree)
            const menusQuery = async () => {
                const res = await supabase
                    .from('menus')
                    .select('id, name, template_id, bar_id, is_active, created_at, cover_url, cover_position')
                    .order('created_at');
                if (res.error) {
                    console.warn("Failed to fetch menus with cover fields, attempting fallback:", res.error.message);
                    const withCover = await supabase
                        .from('menus')
                        .select('id, name, template_id, bar_id, is_active, created_at, cover_url')
                        .order('created_at');
                    if (!withCover.error) {
                        return (withCover.data || []).map((m) => ({ ...m, cover_position: 50 }));
                    }
                    const withBar = await supabase
                        .from('menus')
                        .select('id, name, template_id, bar_id, is_active, created_at')
                        .order('created_at');
                    if (!withBar.error) {
                        return (withBar.data || []).map((m) => ({ ...m, cover_url: null, cover_position: 50 }));
                    }
                    const fallbackRes = await supabase
                        .from('menus')
                        .select('id, name, template_id, is_active, created_at')
                        .order('created_at');
                    if (fallbackRes.error) throw fallbackRes.error;
                    return (fallbackRes.data || []).map((m) => ({
                        ...m,
                        bar_id: null,
                        cover_url: null,
                        cover_position: 50,
                    }));
                }
                return res.data || [];
            };

            // A request stops at 1,000 rows. Specs used to share one with 5,000+
            // ingredients sorted by name, so a new method like "Freezer pour" never
            // showed up, and the ingredient picker missed most ingredients.
            // One of each ingredient (20261008100000): other names, and the core list pickers put first.
            // Either may be missing on a database without that migration; pickers then work as before.
            const aliasesQuery = async () => {
                const res = await supabase.from('ingredient_aliases').select('key, item_id').range(0, 9999);
                return res.error ? [] : (res.data ?? []);
            };
            const coreQuery = async () => {
                const res = await supabase.from('items').select('id').eq('is_core', true).range(0, 9999);
                return res.error ? [] : (res.data ?? []).map((r) => r.id as string);
            };
            const [specs, ingredients, menusData, templatesRes, sectionsRes, categoriesRes, ingredientAliases, coreIngredientIds] = await Promise.all([
                allRows((from, to) =>
                    supabase
                        .from('app_item_presentation')
                        .select('*, item_images(images(url))')
                        .in('item_type', ['method', 'glassware', 'family', 'ice'])
                        .order('name')
                        .order('id')
                        .range(from, to)
                ),
                // Only what the pickers read: every column for ~5,400 rows is ~4 MB, too big to
                // persist. ponytail: all of them on the device (~1 MB); search server-side past ~20,000.
                allRows((from, to) =>
                    supabase
                        .from('app_item_presentation')
                        .select('id, name, item_type, generic_id, bar_id, hide_from_search, item_images(images(url))')
                        .eq('item_type', 'ingredient')
                        .order('name')
                        .order('id')
                        .range(from, to)
                ),
                menusQuery(),
                supabase.from('menu_templates').select('*').order('name'),
                supabase.from('template_sections').select('*').order('sort_order'),
                supabase.from('categories').select('*').order('name'),
                aliasesQuery(),
                coreQuery(),
            ]);

            return {
                methods: specs.filter(item => item.item_type === 'method'),
                glassware: specs.filter(item => item.item_type === 'glassware'),
                families: specs.filter(item => item.item_type === 'family'),
                iceTypes: specs.filter(item => item.item_type === 'ice'),
                ingredients,
                menus: menusData,
                menuTemplates: templatesRes.data || [],
                templateSections: sectionsRes.data || [],
                categories: categoriesRes.data || [],
                ingredientAliases,
                coreIngredientIds,
            };
        },
        // We can cache these for a long time since they change rarely
        staleTime: 1000 * 60 * 60, // 1 hour
    });
}
