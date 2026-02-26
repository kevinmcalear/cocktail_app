import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

export function useBeers() {
    return useQuery({
        queryKey: ['beers'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('beers')
                .select('*, beer_images(images(url))')
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
                .from('beers')
                .select('*, beer_images(images(url))')
                .eq('id', id)
                .single();

            if (error) throw error;
            return data;
        }
    });
}
