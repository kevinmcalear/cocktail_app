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
        staleTime: 0, // Always fetch fresh to sync across Web/Mobile
    });

    const saveDraftMutation = useMutation({
        mutationFn: async ({ id, entityType, draftData }: { id?: string, entityType: string, draftData: any }) => {
            if (!user?.id) throw new Error("No user");
            
            const bar_id = draftData.barId || null;
            
            // Augment draftData with the editor's email to avoid complex joins
            const augmentedDraftData = {
                ...draftData,
                last_editor_email: user.email || 'Unknown Email'
            };

            if (id) {
                // Update existing draft
                const { data, error } = await supabase
                    .from('drafts')
                    .update({ draft_data: augmentedDraftData, bar_id, user_id: user.id, updated_at: new Date().toISOString() })
                    .eq('id', id)
                    .select()
                    .single();
                if (error) throw error;
                return data;
            } else {
                // Insert new draft
                const { data, error } = await supabase
                    .from('drafts')
                    .insert({ user_id: user.id, entity_type: entityType, draft_data: augmentedDraftData, bar_id })
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
        isFetching: draftsQuery.isFetching,
        saveDraft: saveDraftMutation.mutateAsync,
        deleteDraft: deleteDraftMutation.mutateAsync,
    };
}
