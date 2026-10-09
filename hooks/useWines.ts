import { useViewAs } from '@/hooks/useViewAs';
import { allRows } from '@/lib/allRows';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

/** Every wine the person can see, at home and every venue; screens filter by place, so switching doesn't download it again. */
export function useWines() {
    const { viewAsRoleLevel } = useViewAs();

    return useQuery({
        queryKey: ['wines', viewAsRoleLevel],
        queryFn: () =>
            allRows((from, to) => {
                return supabase
                    .from('app_item_presentation')
                    .select('*, item_images(sort_order,image_id,is_generated,outdated_since,images(id,url,palette)), item_categories(category_id)')
                    .eq('item_type', 'wine')
                    .order('name', { ascending: true }).order('id').range(from, to);
            })
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
                .select('*, item_images(sort_order,image_id,is_generated,outdated_since,images(id,url,palette)), item_categories(category_id)')
                .eq('id', id)
                .single();

            if (error) throw error;
            return data;
        }
    });
}
