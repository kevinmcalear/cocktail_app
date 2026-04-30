import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

export function useBars() {
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user?.id) {
                setUserId(session.user.id);
            }
        });
    }, []);

    return useQuery({
        queryKey: ['bars', userId],
        enabled: !!userId,
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
                `)
                .eq('user_id', userId);
                
            if (error) throw error;
            return data;
        }
    });
}
