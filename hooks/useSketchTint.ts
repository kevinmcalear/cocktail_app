import { useMutation, useQueryClient } from '@tanstack/react-query';

import { withTint, type SketchInputs } from '@/lib/sketch/types';
import { supabase } from '@/lib/supabase';

/**
 * The colour a drink's sketch is painted (items.sketch_liquid), or null for
 * Auto. The database copies it into the drawing inputs
 * (20261017100000_sketch_liquid.sql); the cached inputs take it at once, so
 * every tile of the drink repaints before the row comes back.
 */
export function useSetSketchTint(itemId: string) {
  const queryClient = useQueryClient();
  const key = ['item-sketch', itemId];
  return useMutation({
    mutationFn: async (tint: string | null) => {
      const { data, error } = await supabase.from('items').update({ sketch_liquid: tint }).eq('id', itemId).select('id');
      if (error) throw error;
      // RLS skips rows you can't edit without an error.
      if (!data?.length) throw new Error("You can't change this drink.");
    },
    onMutate: async (tint) => {
      await queryClient.cancelQueries({ queryKey: key });
      const before = queryClient.getQueryData<SketchInputs | null>(key);
      if (before) queryClient.setQueryData<SketchInputs>(key, withTint(before, tint));
      return { before };
    },
    onError: (_error, _tint, context) => {
      if (context?.before) queryClient.setQueryData(key, context.before);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: key }),
  });
}
