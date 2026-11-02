import { lazy, Suspense } from 'react';

// burnt and its Toaster are sonner (about 7 KB brotli): they load straight
// after the first render instead of with every page. Toasts made before then
// wait for it (lib/systemToast.web.ts).
const Toaster = lazy(() => import('./ListeningToaster.web').then((m) => ({ default: m.ListeningToaster })));

/** Where web toasts show. */
export function WebToaster() {
  return (
    <Suspense fallback={null}>
      <Toaster />
    </Suspense>
  );
}
