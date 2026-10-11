import { useViewAs } from '@/hooks/useViewAs';
import { allRows } from '@/lib/allRows';
import { venueListOptions } from '@/lib/queryDefaults';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

/** Every wine the person can see, at home and every venue; screens filter by place, so switching doesn't download it again. */
export function useWines(barIds?: readonly string[]) {
    const { viewAsRoleLevel } = useViewAs();

    return useQuery({
        queryKey: barIds ? ['wines', viewAsRoleLevel, 'bars', barIds] : ['wines', viewAsRoleLevel],
        ...venueListOptions(barIds),
        queryFn: () =>
            allRows((from, to) => {
                const query = supabase
                    .from('app_item_presentation')
                    .select('*, item_images(sort_order,image_id,is_generated,outdated_since,images(id,url,palette)), item_categories(category_id)')
                    .eq('item_type', 'wine');
                return (barIds ? query.in('bar_id', barIds) : query)
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
