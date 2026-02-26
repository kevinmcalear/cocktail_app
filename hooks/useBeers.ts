import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

export function useBeers() {
    return useQuery({
        queryKey: ['beers'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('beers')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;
            return data;
        }
    });
}
