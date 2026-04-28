import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

export function useBars() {
    return useQuery({
        queryKey: ['bars'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('user_bars')
                .select(`
                    bar_id,
                    role_level,
                    bars:bar_id (
                        id,
                        name
                    )
                `);
                
            if (error) throw error;
            return data;
        }
    });
}
