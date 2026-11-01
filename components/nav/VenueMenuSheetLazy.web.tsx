import { lazy, Suspense } from 'react';

const Lazy = lazy(() => import('./VenueMenuSheet').then((m) => ({ default: m.VenueMenuSheet })));

/**
 * On the web, the venue menu (the team card, the places list and the hooks
 * behind them) loads when the switcher is first tapped, not with every page
 * that has a header.
 */
export function VenueMenuSheet(props: { onClose: () => void }) {
  return (
    <Suspense fallback={null}>
      <Lazy {...props} />
    </Suspense>
  );
}
