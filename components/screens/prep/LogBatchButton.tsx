import { useRouter, type Href } from 'expo-router';

import { Button, useToast } from '@/components/ds';
import { useLogBatch } from '@/hooks/useBatches';
import { itemHref } from '@/lib/itemRoutes';
import { formatQuantity, toQuantity } from '@/lib/quantity';

/**
 * Log batch on a low house-made's row (Tonight's Before doors, Drinks'
 * House-made): logs one batch of its recipe at once, and it waits on the
 * phone with no signal. A recipe that doesn't say what it makes opens its
 * page instead.
 */
export function LogBatchButton({ barId, id, name, batch }: { barId: string; id: string; name: string; batch: { amount: number; unit: string } | null }) {
  const router = useRouter();
  const toast = useToast();
  const logBatch = useLogBatch(barId);
  const log = () => {
    if (!batch) return router.push(itemHref('Ingredient', id) as Href);
    logBatch.mutate({ itemId: id, ...batch });
    const q = toQuantity(batch.amount, batch.unit);
    toast.show({ title: `Logged ${q ? formatQuantity(q) : `${batch.amount} ${batch.unit}`} of ${name}` });
  };
  return <Button label="Log batch" size="sm" variant="secondary" accessibilityLabel={`Log a batch of ${name}`} onPress={log} />;
}
