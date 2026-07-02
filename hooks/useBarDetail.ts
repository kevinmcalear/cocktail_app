import { supabase } from '@/lib/supabase';
import { DatabaseBar } from '@/types/types';
import { useQuery } from '@tanstack/react-query';

export function useBarDetail(barId: string) {
    return useQuery({
        queryKey: ['bar', barId],
        queryFn: async () => {
            if (!barId) return null;

            const [barResponse, membersResponse, itemsResponse] = await Promise.all([
                supabase
                    .from('bars')
                    .select(`
                        id,
                        name,
                        logo_url,
                        primary_color,
                        secondary_color,
                        default_visibility_level,
                        default_generic_ingredient_level,
                        default_specific_brand_level,
                        default_measurement_level,
                        default_prep_level,
                        created_at
                    `)
                    .eq('id', barId)
                    .single(),
                supabase
                    .rpc('get_bar_members', { p_bar_id: barId }),
                supabase
                    .from('items')
                    .select('id, name, item_type')
                    .eq('bar_id', barId)
            ]);

            if (barResponse.error) throw barResponse.error;
            if (membersResponse.error) throw membersResponse.error;
            
            return {
                bar: barResponse.data as DatabaseBar,
                members: membersResponse.data || [],
                items: itemsResponse.data || []
            };
        },
        enabled: !!barId,
        staleTime: 0,
        refetchOnMount: 'always',
    });
}
