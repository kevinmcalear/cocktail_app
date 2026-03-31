import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

export function useWines() {
    return useQuery({
        queryKey: ['wines'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('items')
                .select('*, item_images(images(url))')
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
                .select('*, item_images(images(url))')
                .eq('id', id)
                .single();

            if (error) throw error;
            return data;
        }
    });
}
