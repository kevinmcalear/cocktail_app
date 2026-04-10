import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

export function useWines() {
    return useQuery({
        queryKey: ['wines'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('items')
                .select('*, item_images(sort_order,image_id,images(id,url)), item_categories(category_id)')
                .eq('item_type', 'wine')
                .order('name', { ascending: true });

            if (error) throw error;
            return data;
        }
    });
}

export function useWine(id: string) {
    return useQuery({
        queryKey: ['wine', id],
        enabled: !!id,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('items')
                .select('*, item_images(sort_order,image_id,images(id,url)), item_categories(category_id)')
                .eq('id', id)
                .single();

            if (error) throw error;
            return data;
        }
    });
}
