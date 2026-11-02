import { lazy, Suspense, type ComponentProps } from 'react';

import type * as AddBeerWine from '@/components/screens/addBeerWine/AddBeerWineRoute';

import type * as BeerWine from './BeerWineScreen';

export type { AddDrinkProps } from '@/components/screens/addBeerWine/AddBeerWineRoute';

const LazyAdd = lazy(() => import('@/components/screens/addBeerWine/AddBeerWineRoute').then((m) => ({ default: m.AddBeerWineRoute })));
const LazyPage = lazy(() => import('./BeerWineScreen').then((m) => ({ default: m.BeerWineScreen })));

/*
 * On the web the beer and wine routes import their page lazily, so it ships
 * once. Imported directly, /beer/<id> and /wine/<id> each carried a full copy
 * of the page (about 760 KB), and /add-beer and /add-wine of the wizard
 * (about 2 MB each), quality budget B12.
 */

export function AddBeerWineRoute(props: ComponentProps<typeof AddBeerWine.AddBeerWineRoute>) {
  return (
    <Suspense fallback={null}>
      <LazyAdd {...props} />
    </Suspense>
  );
}

export function BeerWineScreen(props: ComponentProps<typeof BeerWine.BeerWineScreen>) {
  return (
    <Suspense fallback={null}>
      <LazyPage {...props} />
    </Suspense>
  );
}
