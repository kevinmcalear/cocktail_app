import { useViewAs } from '@/hooks/useViewAs';
import { allRows } from '@/lib/allRows';
import { venueListOptions } from '@/lib/queryDefaults';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

/** Every beer the person can see, or one place's: `barIds` for venues, `'home'` for the rows home shows (no venue's). */
export function useBeers(barIds?: readonly string[] | 'home') {
    const { viewAsRoleLevel } = useViewAs();
    const venues = barIds === 'home' ? undefined : barIds;

    return useQuery({
        queryKey: venues ? ['beers', viewAsRoleLevel, 'bars', venues] : barIds === 'home' ? ['beers', viewAsRoleLevel, 'home'] : ['beers', viewAsRoleLevel],
        ...venueListOptions(venues),
        queryFn: () =>
            allRows((from, to) => {
                const query = supabase
                    .from('app_item_presentation')
                    .select('*, item_images(sort_order,image_id,is_generated,outdated_since,images(id,url,palette)), item_categories(category_id)')
                    .eq('item_type', 'beer');
                return (venues ? query.in('bar_id', venues) : barIds === 'home' ? query.is('bar_id', null) : query)
                    .order('name', { ascending: true }).order('id').range(from, to);
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
