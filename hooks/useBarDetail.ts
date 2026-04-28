import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

export function useBarDetail(barId: string) {
    return useQuery({
        queryKey: ['bar', barId],
        queryFn: async () => {
            if (!barId) return null;

            const [barResponse, membersResponse, itemsResponse] = await Promise.all([
                supabase
                    .from('bars')
                    .select('*')
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
                bar: barResponse.data,
                members: membersResponse.data || [],
                items: itemsResponse.data || []
            };
        },
        enabled: !!barId
    });
}
