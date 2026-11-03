import { useMemo } from 'react';

import { useCapabilities } from '@/hooks/useCapabilities';
import { usePrepData } from '@/hooks/usePrepList';
import { buildPrepList, DEFAULT_SERVES, tonightAt6 } from '@/lib/prep';

/**
 * Tonight's prep at a bar, from the lists on now: what house-made to make
 * (Prep's own rule, lib/prep), what to order, and each house-made's batch for
 * a one-tap Log batch. Staff Tonight's Before doors and Drinks' House-made
 * and Bottles read it, so the query is shared. Specs is the drink makers'
 * permission; without it or Prep there's nothing (canPrep false).
 */
export function useTonightPrep(barId: string | null, menuIds: readonly string[], now: Date) {
  const caps = useCapabilities(barId).data;
  const canPrep = Array.isArray(caps) && (caps.includes('prep') || caps.includes('specs'));
  const query = usePrepData(canPrep ? barId : null, [...menuIds]);
  const prepData = query.data;
  const prep = useMemo(() => (prepData ? buildPrepList({ ...prepData, servesPerDrink: DEFAULT_SERVES, startsAt: tonightAt6(), now }) : null), [prepData, now]);
  /** A house-made's batch, for a one-tap Log batch; null when its recipe doesn't say what it makes. */
  const batchOf = (id: string) => {
    const hm = prepData?.houseMade[id];
    return hm?.yieldAmount && hm.yieldUnit ? { amount: hm.yieldAmount, unit: hm.yieldUnit } : null;
  };
  return { canPrep, prepData, prep, batchOf, isLoading: canPrep && menuIds.length > 0 && query.isLoading };
}
