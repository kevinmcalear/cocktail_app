import { lazy, Suspense } from 'react';

// Neither shows on a page's first paint: a dialog waits for an Alert, the
// banner for View as. They load straight after the first render instead of
// with every page, as the toasts do (components/WebToaster.web.tsx).
const Dialogs = lazy(() => import('@/components/DialogHost').then((m) => ({ default: m.DialogHost })));
const Banner = lazy(() => import('@/components/ViewAsBanner').then((m) => ({ default: m.ViewAsBanner })));

/** Alert.alert's card on the web (components/DialogHost.tsx). */
export function DialogHost() {
  return (
    <Suspense fallback={null}>
      <Dialogs />
    </Suspense>
  );
}

/** "Viewing as" with Exit (components/ViewAsBanner.tsx). */
export function ViewAsBanner() {
  return (
    <Suspense fallback={null}>
      <Banner />
    </Suspense>
  );
}
