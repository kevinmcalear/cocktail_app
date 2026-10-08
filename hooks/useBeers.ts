import { useViewAs } from '@/hooks/useViewAs';
import { allRows } from '@/lib/allRows';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { applyBarContextFilter } from '@/lib/barContextFilter';
import { useAppStore } from '@/store/useAppStore';

export function useBeers(options?: { allContexts?: boolean }) {
    const selectedContextIds = useAppStore((state) => state.selectedContextIds);
    const { viewAsRoleLevel } = useViewAs();
    // Every venue's list ignores the picked venues, so switching venue doesn't download it again.
    const contexts = options?.allContexts ? null : selectedContextIds;

    return useQuery({
        queryKey: ['beers', contexts, options, viewAsRoleLevel],
        queryFn: () =>
            allRows((from, to) => {
                let query = supabase
                    .from('app_item_presentation')
                    .select('*, item_images(sort_order,image_id,is_generated,outdated_since,images(id,url,palette)), item_categories(category_id)')
                    .eq('item_type', 'beer');

                if (contexts) query = applyBarContextFilter(query, contexts);

                return query.order('name', { ascending: true }).order('id').range(from, to);
            })
    });
}

export function useBeer(id: string) {
    const { viewAsRoleLevel } = useViewAs();
    return useQuery({
        queryKey: ['beer', id, viewAsRoleLevel],
        enabled: !!id,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('app_item_presentation')
                .select('*, item_images(sort_order,image_id,is_generated,outdated_since,images(id,url,palette)), item_categories(category_id)')
                .eq('id', id)
                .single();

            if (error) throw error;
            return data;
        }
    });
}
