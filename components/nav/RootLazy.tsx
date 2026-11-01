import { lazy, Suspense } from 'react';
import { View } from 'react-native';

import { layout } from '@/constants/tokens';
import { WEB_SIDEBAR_WIDTH } from '@/hooks/useIsWideWeb';

// Not on a phone's first screen (wide web, signed in, or a shake): the root
// layout loads these when first shown, so their code isn't on every page's
// first load (RAIL load).
const WebSideNav = lazy(() => import('@/components/nav/WebSideNav').then((m) => ({ default: m.WebSideNav })));
const SearchPalette = lazy(() => import('@/components/search/SearchPalette').then((m) => ({ default: m.SearchPalette })));
const EightBallHost = lazy(() => import('@/components/screens/eightball/EightBallHost').then((m) => ({ default: m.EightBallHost })));
const ScreenshotReportHost = lazy(() => import('@/components/feedback/ScreenshotReport').then((m) => ({ default: m.ScreenshotReportHost })));
const BringInHost = lazy(() => import('@/components/screens/bringin/BringInHost').then((m) => ({ default: m.BringInHost })));
// Only a desktop at a venue draws it, beside the Drinks stack, so it loads with Drinks, not with every tab's stack.
const LibraryScreen = lazy(() => import('@/components/screens/LibraryScreen').then((m) => ({ default: m.LibraryScreen })));

const SignedInSyncHost = lazy(() => import('@/components/SignedInSync'));
// The tab stacks' layout loads under every page, a share page too (the router
// reads its anchors), so what only some tabs draw loads when first drawn.
const DrinksListHost = lazy(() => import('@/components/nav/DrinksSplit').then((m) => ({ default: m.DrinksList })));
const AddFabHost = lazy(() => import('@/components/nav/AddButton').then((m) => ({ default: m.AddFab })));

/** Drinks' list column on a desktop at a venue (DrinksSplit.tsx); its width is held while it loads. */
export function DrinksList({ shown }: { shown: boolean }) {
  return (
    <Suspense fallback={shown ? <View style={{ width: layout.listPaneDesk }} /> : null}>
      <DrinksListHost shown={shown} />
    </Suspense>
  );
}

/** Android's floating Add on each tab's first page (AddButton.tsx). */
export function AddFab() {
  return (
    <Suspense fallback={null}>
      <AddFabHost />
    </Suspense>
  );
}

/** Wizard drafts kept in the account and the venues' spec books (components/SignedInSync.tsx). */
export function SignedInSync() {
  return (
    <Suspense fallback={null}>
      <SignedInSyncHost />
    </Suspense>
  );
}

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

/** Drinks' list in its column beside a drink on a desktop (DrinksSplit.tsx). */
export function LibraryBeside() {
  return (
    <Suspense fallback={null}>
      <LibraryScreen beside />
    </Suspense>
  );
}
