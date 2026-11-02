import { useRouter, type Href } from 'expo-router';

import { Button, useToast } from '@/components/ds';
import { useLogBatch } from '@/hooks/useBatches';
import { itemHref } from '@/lib/itemRoutes';
import { formatQuantity, toQuantity } from '@/lib/quantity';

/**
 * Log batch at one tap: one batch of the recipe, with a toast, and it waits on
 * the phone with no signal. A recipe that doesn't say what it makes opens its
 * page instead. The button below and the handover's What to prep share it.
 */
export function useLogBatchNow(barId: string) {
  const router = useRouter();
  const toast = useToast();
  const logBatch = useLogBatch(barId);
  return (id: string, name: string, batch: { amount: number; unit: string } | null) => () => {
    if (!batch) return router.push(itemHref('Ingredient', id) as Href);
    logBatch.mutate({ itemId: id, ...batch });
    const q = toQuantity(batch.amount, batch.unit);
    toast.show({ title: `Logged ${q ? formatQuantity(q) : `${batch.amount} ${batch.unit}`} of ${name}` });
  };
}

/** Log batch on a low house-made's row (Tonight's Before doors, Drinks' House-made). */
export function LogBatchButton({ barId, id, name, batch }: { barId: string; id: string; name: string; batch: { amount: number; unit: string } | null }) {
  const log = useLogBatchNow(barId)(id, name, batch);
  return <Button label="Log batch" size="sm" variant="secondary" accessibilityLabel={`Log a batch of ${name}`} onPress={log} />;
}
