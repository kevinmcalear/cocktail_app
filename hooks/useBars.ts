import { useAuth } from '@/ctx/AuthContext';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

export function useBars() {
    // Follows sign-in and sign-out, so a screen that stays mounted across
    // them (the venue staff link) sees the new user's bars.
    const userId = useAuth().user?.id ?? null;

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
                        name,
                        logo_url,
                        primary_color,
                        secondary_color
                    )
                `)
                .eq('user_id', userId);
                
            if (error) throw error;
            return data;
        }
    });
}
