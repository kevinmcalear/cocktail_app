import { MenuSection } from '@/components/CurrentMenuList';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

export function useMenuDetails(menuId: string | null) {
    return useQuery({
        queryKey: ['menu', menuId],
        enabled: !!menuId,
        queryFn: async () => {
            // 1. Get the Menu mapping
            const { data: menuData, error: menuErr } = await supabase
                .from('menus')
                .select('*')
                .eq('id', menuId)
                .single();
            
            if (menuErr || !menuData) throw menuErr || new Error("Menu not found");

            // 2. Get the template sections for this menu
            const { data: sections, error: secErr } = await supabase
                .from('template_sections')
                .select('*')
                .eq('template_id', menuData.template_id)
                .order('sort_order');
                
            if (secErr) throw secErr;

            // 3. Get drinks
            const { data: drinksData, error: drinksErr } = await supabase
                .from('menu_drinks')
                .select(`
                    template_section_id,
                    sort_order,
                    cocktails (
                        id, name, description,
                        cocktail_images (
                            images ( url )
                        ),
                        recipes (
                            ingredient_amount, ingredient_ml, ingredient_bsp,
                            ingredients!recipes_ingredient_id_fkey ( name )
                        )
                    )
                `)
                .eq('menu_id', menuId);
                
            if (drinksErr) throw drinksErr;

            // 4. Format into sections
            const defaultImage = require('@/assets/images/cocktails/house_martini.png');

            const formattedSections: MenuSection[] = (sections || []).map((sec: any) => {
                const secDrinks = (drinksData || [])
                    .filter(d => d.template_section_id === sec.id)
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map(d => {
                        // Suppress TS errors since we don't have perfect types here
                        const c = d.cocktails as any;
                        if (!c) return null;

                        const rList = Array.isArray(c.recipes) ? c.recipes : [c.recipes];
                        const ingList = rList.filter(Boolean).map((r: any) => {
                            const amt = r.ingredient_amount ? `${r.ingredient_amount} ` : (r.ingredient_ml ? `${r.ingredient_ml}ml ` : (r.ingredient_bsp ? `${r.ingredient_bsp}bsp ` : ''));
                            return `${amt}${r.ingredients?.name || ''}`.trim();
                        }).filter(Boolean).join(', ');
                        
                        let imageUrl = defaultImage;
                        if (c.cocktail_images && c.cocktail_images.length > 0) {
                            const imgArr = Array.isArray(c.cocktail_images) ? c.cocktail_images : [c.cocktail_images];
                            if (imgArr[0]?.images?.url) {
                                imageUrl = imgArr[0].images.url;
                            }
                        }

                        const item: import('@/components/CurrentMenuList').MenuItem = {
                            id: c.id,
                            name: c.name,
                            description: c.description || "",
                            ingredients: ingList,
                            image: imageUrl,
                        };
                        return item;
                    }).filter((item): item is import('@/components/CurrentMenuList').MenuItem => item !== null);
                
                return {
                    id: sec.id,
                    title: sec.name,
                    data: secDrinks
                };
            });
                
            return {
                menuName: menuData.name,
                // Only return sections that have drinks
                sections: formattedSections.filter(s => s.data.length > 0)
            };
        }
    });
}
