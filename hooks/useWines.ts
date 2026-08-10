import { useViewAs } from '@/hooks/useViewAs';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { applyBarContextFilter } from '@/lib/barContextFilter';
import { useAppStore } from '@/store/useAppStore';

export function useWines(options?: { allContexts?: boolean }) {
    const selectedContextIds = useAppStore((state) => state.selectedContextIds);
    const { viewAsRoleLevel } = useViewAs();

    return useQuery({
        queryKey: ['wines', selectedContextIds, options, viewAsRoleLevel],
        queryFn: async () => {
            let query = supabase
                .from('app_item_presentation')
                .select('*, item_images(sort_order,image_id,images(id,url)), item_categories(category_id)')
                .eq('item_type', 'wine');

            if (!options?.allContexts) {
                query = applyBarContextFilter(query, selectedContextIds);
            }

            const { data, error } = await query.order('name', { ascending: true });

            if (error) throw error;
            return data;
        }
    });
}

export function useWine(id: string) {
    const { viewAsRoleLevel } = useViewAs();
    return useQuery({
        queryKey: ['wine', id, viewAsRoleLevel],
        enabled: !!id,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('app_item_presentation')
                .select('*, item_images(sort_order,image_id,images(id,url)), item_categories(category_id)')
                .eq('id', id)
                .single();

            if (error) throw error;
            return data;
        }
    });
}
