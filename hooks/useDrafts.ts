import { supabase } from '@/lib/supabase';
import { useAuth } from '@/ctx/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DatabaseDraft } from '@/types/types';

export function useDrafts() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const draftsQuery = useQuery({
        queryKey: ['drafts', user?.id],
        queryFn: async () => {
            if (!user?.id) return [];
            const { data, error } = await supabase
                .from('drafts')
                .select('*')
                .order('updated_at', { ascending: false });

            if (error) throw error;
            return data as DatabaseDraft[];
        },
        enabled: !!user?.id,
    });

    const saveDraftMutation = useMutation({
        mutationFn: async ({ id, entityType, draftData }: { id?: string, entityType: string, draftData: any }) => {
            if (!user?.id) throw new Error("No user");
            
            if (id) {
                // Update existing draft
                const { data, error } = await supabase
                    .from('drafts')
                    .update({ draft_data: draftData, updated_at: new Date().toISOString() })
                    .eq('id', id)
                    .select()
                    .single();
                if (error) throw error;
                return data;
            } else {
                // Insert new draft
                const { data, error } = await supabase
                    .from('drafts')
                    .insert({ user_id: user.id, entity_type: entityType, draft_data: draftData })
                    .select()
                    .single();
                if (error) throw error;
                return data;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['drafts'] });
        }
    });

    const deleteDraftMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('drafts').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['drafts'] });
        }
    });

    return {
        drafts: draftsQuery.data || [],
        isLoading: draftsQuery.isLoading,
        saveDraft: saveDraftMutation.mutateAsync,
        deleteDraft: deleteDraftMutation.mutateAsync,
    };
}
