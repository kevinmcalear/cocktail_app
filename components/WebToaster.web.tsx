import { lazy, Suspense } from 'react';

// burnt's Toaster is sonner (about 10 KB brotli): it loads straight after the
// first render instead of with every page, and toasts load on the first one
// (lib/systemToast.web.ts).
const Toaster = lazy(() => import('burnt/web').then((m) => ({ default: m.Toaster })));

/** Where web toasts show. */
export function WebToaster() {
  return (
    <Suspense fallback={null}>
      <Toaster />
    </Suspense>
  );
}
