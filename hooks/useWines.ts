import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/store/useAppStore';

export function useWines(options?: { globalOnly?: boolean; allContexts?: boolean }) {
    const selectedBarId = useAppStore(state => state.selectedBarId);

    return useQuery({
        queryKey: ['wines', selectedBarId, options],
        queryFn: async () => {
            let query = supabase
                .from('app_item_presentation')
                .select('*, item_images(sort_order,image_id,images(id,url)), item_categories(category_id)')
                .eq('item_type', 'wine');

            if (options?.allContexts) {
                // Do not filter by bar_id
            } else if (options?.globalOnly) {
                query = query.is('bar_id', null);
            } else if (selectedBarId) {
                query = query.eq('bar_id', selectedBarId);
            } else {
                query = query.is('bar_id', null);
            }

            const { data, error } = await query.order('name', { ascending: true });

            if (error) throw error;
            return data;
        }
    });
}

export function useWine(id: string) {
    return useQuery({
        queryKey: ['wine', id],
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
