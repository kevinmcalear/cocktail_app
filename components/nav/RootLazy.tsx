import { lazy, Suspense } from 'react';
import { View } from 'react-native';

import { WEB_SIDEBAR_WIDTH } from '@/hooks/useIsWideWeb';

// Not on a phone's first screen (wide web, signed in, or a shake): the root
// layout loads these when first shown, so their code isn't on every page's
// first load (RAIL load).
const WebSideNav = lazy(() => import('@/components/nav/WebSideNav').then((m) => ({ default: m.WebSideNav })));
const SearchPalette = lazy(() => import('@/components/search/SearchPalette').then((m) => ({ default: m.SearchPalette })));
const EightBallHost = lazy(() => import('@/components/screens/eightball/EightBallHost').then((m) => ({ default: m.EightBallHost })));
const ScreenshotReportHost = lazy(() => import('@/components/feedback/ScreenshotReport').then((m) => ({ default: m.ScreenshotReportHost })));
const BringInHost = lazy(() => import('@/components/screens/bringin/BringInHost').then((m) => ({ default: m.BringInHost })));

/** The wide web's side nav; its width is held while it loads, so nothing shifts. */
export function SideNav() {
  return (
    <Suspense fallback={<View style={{ width: WEB_SIDEBAR_WIDTH }} />}>
      <WebSideNav />
    </Suspense>
  );
}

/** Bring in's sheet, drop dialog and reading tray. */
export function BringIn() {
  return (
    <Suspense fallback={null}>
      <BringInHost />
    </Suspense>
  );
}

/** The ⌘K palette (wide web), and signed in, the eight ball and Report a problem from a screenshot. */
export function RootExtras({ palette, signedIn }: { palette: boolean; signedIn: boolean }) {
  return (
    <Suspense fallback={null}>
      {palette ? <SearchPalette /> : null}
      {signedIn ? <EightBallHost /> : null}
      {signedIn ? <ScreenshotReportHost /> : null}
    </Suspense>
  );
}
