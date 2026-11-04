import { lazy, Suspense } from 'react';

const Lazy = lazy(() => import('./RoundDrinkScreen').then((m) => ({ default: m.RoundDrinkScreen })));

/**
 * On the web, the first round's drink page loads on demand: its spec code
 * (lib/specView, lib/batch) would otherwise count as one more route's import
 * and tip lib/batch into the chunk every page loads (the 20-route rule,
 * patches/@expo+metro-config).
 */
export function RoundDrinkScreen(props: { id: string }) {
  return (
    <Suspense fallback={null}>
      <Lazy {...props} />
    </Suspense>
  );
}
