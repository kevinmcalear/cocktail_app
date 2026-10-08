import { supabase } from '@/lib/supabase';
import { DatabaseBar } from '@/types/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/** A row from get_bar_members(). Emails come back to the venue's admins only (and your own row). */
export interface BarMember {
    user_id: string;
    email: string | null;
    role_level: number;
    /** The name they signed up with, or the part of their email before @. */
    display_name?: string | null;
    joined_at?: string | null;
    /** Their Settings photo, else their profile picture. */
    avatar_url?: string | null;
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
 * Changes a member's role, or invites anyone else by email and name (they join
 * when they accept). The add_user_to_bar_by_email RPC decides who may: only the venue's
 * real Admins, and only to a valid role level. Errors show inline, not as the
 * global toast.
 */
export function useSetMemberRole(barId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        /** Resolves to true when it made an invite, false when it changed a member's role. */
        mutationFn: async ({ email, roleLevel, name }: { email: string; roleLevel: number; name?: string }): Promise<boolean> => {
            const { data, error } = await supabase.rpc('add_user_to_bar_by_email', {
                p_email: email.trim().toLowerCase(),
                p_bar_id: barId,
                p_role_level: roleLevel,
                p_name: name?.trim() || undefined,
            });
            if (error) throw error;
            return !data?.user_id;
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['bar', barId] });
            await queryClient.invalidateQueries({ queryKey: ['bar-members', barId] });
            await queryClient.invalidateQueries({ queryKey: ['bar-invites', barId] });
        },
        onError: () => {},
    });
}

/** The venue's roster. Names for everyone on the team; emails for admins. */
export function useBarMembers(barId: string | null) {
    return useQuery({
        queryKey: ['bar-members', barId],
        enabled: !!barId,
        staleTime: 0,
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_bar_members', { p_bar_id: barId! });
            if (error) throw error;
            return (data ?? []) as BarMember[];
        },
    });
}

/** Takes someone off the venue. The database keeps the last Admin. */
export function useRemoveMember(barId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (userId: string) => {
            const { error } = await supabase.from('user_bars').delete().eq('bar_id', barId).eq('user_id', userId);
            if (error) throw error;
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['bar', barId] });
            await queryClient.invalidateQueries({ queryKey: ['bar-members', barId] });
        },
        onError: () => {},
    });
}
