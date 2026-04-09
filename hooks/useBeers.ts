import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

export function useBeers() {
    return useQuery({
        queryKey: ['beers'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('items')
                .select('*, item_images(sort_order,image_id,images(id,url))')
                .eq('item_type', 'beer')
                .order('name', { ascending: true });

            if (error) throw error;
            return data;
        }
    });
}

export function useBeer(id: string) {
    return useQuery({
        queryKey: ['beer', id],
        enabled: !!id,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('items')
                .select('*, item_images(sort_order,image_id,images(id,url))')
                .eq('id', id)
                .single();

            if (error) throw error;
            return data;
        }
    });
}
