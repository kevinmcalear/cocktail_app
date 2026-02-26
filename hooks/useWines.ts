import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

export function useWines() {
    return useQuery({
        queryKey: ['wines'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('wines')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;
            return data;
        }
    });
}
