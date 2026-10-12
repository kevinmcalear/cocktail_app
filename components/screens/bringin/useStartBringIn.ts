import { useRouter, type Href } from 'expo-router';

import type { ReadKind, ReadSource } from '@/lib/bringIn';
import { useBringIn, type BringInJob } from '@/store/useBringIn';

/**
 * Starts reading what was given and opens the Reading view. Several things
 * (a drop of files) are checked one after another; anything given while a
 * check is still open waits its turn behind it. `barId` is where it comes in
 * (useBringInPlace), null for your home bar.
 */
export function useStartBringIn() {
  const router = useRouter();
  return (sources: ReadSource[], options: { barId: string | null; hint?: ReadKind | null; as?: ReadKind | null; menu?: BringInJob['menu'] }) => {
    if (!sources.length) return;
    const store = useBringIn.getState();
    if (store.job && store.job.status !== 'failed') store.enqueue(sources);
    else {
      const [first, ...rest] = sources;
      store.start(first, { barId: options.barId, hint: options.hint, as: options.as, menu: options.menu });
      store.enqueue(rest);
    }
    store.closeSheet();
    // Already on /bring-in (it marks itself foreground): it shows the new job.
    if (!store.foreground) router.push('/bring-in' as Href);
  };
}
