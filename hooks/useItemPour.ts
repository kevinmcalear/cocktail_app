import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Row } from '@/types/db';

/** How the bar pours a beer or wine (migration 20261206020000). */
export const POUR_COLUMNS = 'serve_temp_c, glass_note, pour_note, tap_line, bottle_price';

export type ItemPour = Pick<Row<'items'>, 'serve_temp_c' | 'glass_note' | 'pour_note' | 'tap_line' | 'bottle_price'>;

/**
 * A beer's or wine's pour fields, read from items under its own policy.
 * ponytail: app_item_presentation doesn't carry them (changing a view is
 * Kevin's call); once it does, useBeer and useWine read them and this goes.
 */
export function useItemPour(id: string | null | undefined) {
  return useQuery({
    queryKey: ['item-pour', id],
    enabled: !!id,
    queryFn: async (): Promise<ItemPour | null> => {
      const { data, error } = await supabase.from('items').select(POUR_COLUMNS).eq('id', id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
