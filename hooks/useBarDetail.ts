import { supabase } from '@/lib/supabase';
import { DatabaseBar } from '@/types/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/** A row from get_bar_members(). Emails come back to the venue's admins only (and your own row). */
export interface BarMember {
    user_id: string;
    email: string | null;
    role_level: number;
}

export function useBarDetail(barId: string) {
    return useQuery({
        queryKey: ['bar', barId],
        queryFn: async () => {
            if (!barId) return null;

            const [barResponse, membersResponse, itemsResponse] = await Promise.all([
                supabase
                    .from('bars')
                    .select(`
                        id,
                        name,
                        slug,
                        logo_url,
                        primary_color,
                        secondary_color,
                        default_visibility_level,
                        default_generic_ingredient_level,
                        default_specific_brand_level,
                        default_measurement_level,
                        default_prep_level,
                        created_at
                    `)
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
                bar: barResponse.data as DatabaseBar,
                members: (membersResponse.data || []) as BarMember[],
                items: itemsResponse.data || []
            };
        },
        enabled: !!barId,
        staleTime: 0,
        refetchOnMount: 'always',
    });
}

/**
 * Adds someone to the venue by email, or changes a member's role. The
 * add_user_to_bar_by_email RPC decides who may: only the venue's real Admins,
 * and only to a valid role level. Errors show inline, not as the global toast.
 */
export function useSetMemberRole(barId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ email, roleLevel }: { email: string; roleLevel: number }) => {
            const { error } = await supabase.rpc('add_user_to_bar_by_email', {
                p_email: email.trim().toLowerCase(),
                p_bar_id: barId,
                p_role_level: roleLevel,
            });
            if (error) throw error;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bar', barId] }),
        onError: () => {},
    });
}
