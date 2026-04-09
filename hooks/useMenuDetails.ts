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
                    item:items!item_id (
                        id, name, description, item_type, style, brand_maker, location, price,
                        item_images ( images ( url ) ),
                        recipes!recipe_item_id (
                            amount, unit,
                            ingredient:items!ingredient_item_id ( name )
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
                        const i: any = d.item;
                        if (!i) return null;

                        let imageUrl = defaultImage;
                        if (i.item_images && i.item_images.length > 0) {
                            const imgArr = Array.isArray(i.item_images) ? i.item_images : [i.item_images];
                            if (imgArr[0]?.images?.url) {
                                imageUrl = imgArr[0].images.url;
                            }
                        }

                        if (i.item_type === 'cocktail') {
                            const rList = Array.isArray(i.recipes) ? i.recipes : [i.recipes];
                            const ingList = rList.filter(Boolean).map((r: any) => {
                                const amt = r.amount ? `${r.amount} ` : '';
                                const u = r.unit ? `${r.unit} ` : '';
                                return `${amt}${u}${r.ingredient?.name || ''}`.trim();
                            }).filter(Boolean).join(', ');
                            
                            return {
                                id: i.id,
                                name: i.name,
                                description: i.description || "",
                                ingredients: ingList,
                                image: imageUrl,
                            };
                        } else if (i.item_type === 'beer') {
                            return {
                                id: `beer-${i.id}`,
                                name: i.name,
                                description: i.description || "Craft Beer",
                                ingredients: i.style || i.brand_maker || "Beer",
                                image: imageUrl,
                            };
                        } else if (i.item_type === 'wine') {
                            return {
                                id: `wine-${i.id}`,
                                name: i.name,
                                description: i.description || "Wine",
                                ingredients: i.location || "Wine",
                                image: imageUrl,
                            };
                        }
                        
                        return null;
                    }).filter((item): item is import('@/components/CurrentMenuList').MenuItem => item !== null);
                
                return {
                    id: sec.id,
                    title: sec.name,
                    data: secDrinks
                };
            });
                
            return {
                menuName: menuData.name,
                sections: formattedSections
            };
        }
    });
}
