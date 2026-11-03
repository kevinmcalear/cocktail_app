import { lazy, Suspense, type ComponentProps } from 'react';
import { View } from 'react-native';

import { drawing, menuBandHeight } from '@/constants/tokens';
import { useIsHydrated } from '@/hooks/useIsHydrated';

import type { MenuBand as Band, MenuSky as Sky, MenuStrip as Strip, MenuTrio as Trio } from './MenuBand';

const LazyBand = lazy(() => import('./MenuBand').then((m) => ({ default: m.MenuBand })));
const LazyStrip = lazy(() => import('./MenuBand').then((m) => ({ default: m.MenuStrip })));
const LazySky = lazy(() => import('./MenuBand').then((m) => ({ default: m.MenuSky })));
const LazyTrio = lazy(() => import('./MenuBand').then((m) => ({ default: m.MenuTrio })));

/**
 * On the web the menu rows' drawings (the band, the strip and what paints
 * them) load when a list first shows one, not with every page that lists
 * menus (Tonight, a drink's menus, a bar's page). The space they take shows
 * while they load; the static export renders it too. A menu page's hero (its
 * sky and trio, laid over a space the head keeps) loads the same way.
 */
export function MenuBand(props: ComponentProps<typeof Band>) {
  const hydrated = useIsHydrated();
  const space = <View style={{ height: props.height ?? menuBandHeight }} />;
  if (!hydrated) return space;
  return (
    <Suspense fallback={space}>
      <LazyBand {...props} />
    </Suspense>
  );
}

export function MenuStrip(props: ComponentProps<typeof Strip>) {
  const hydrated = useIsHydrated();
  const space = <View style={{ width: 96, height: drawing.row }} />;
  if (!hydrated) return space;
  return (
    <Suspense fallback={space}>
      <LazyStrip {...props} />
    </Suspense>
  );
}

export function MenuSky(props: ComponentProps<typeof Sky>) {
  const hydrated = useIsHydrated();
  if (!hydrated) return null;
  return (
    <Suspense fallback={null}>
      <LazySky {...props} />
    </Suspense>
  );
}

export function MenuTrio(props: ComponentProps<typeof Trio>) {
  const hydrated = useIsHydrated();
  if (!hydrated) return null;
  return (
    <Suspense fallback={null}>
      <LazyTrio {...props} />
    </Suspense>
  );
}
