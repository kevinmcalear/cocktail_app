import { lazy, Suspense, type ComponentProps } from 'react';

import type * as Guest from './GuestAllergens';
import type * as Team from './TeamAllergens';

const LazyGuest = lazy(() => import('./GuestAllergens').then((m) => ({ default: m.GuestAllergens })));
const LazyTeam = lazy(() => import('./TeamAllergens').then((m) => ({ default: m.TeamAllergens })));

/*
 * On the web the Allergens section (its list, the bar's check sheet and their
 * words) loads from one shared chunk. Imported directly, every chunk that
 * carries the drink page (the drink, published and preview pages, each editor
 * and add route) had its own copy, about 30 KB each (quality budget B12).
 */

export function GuestAllergens(props: ComponentProps<typeof Guest.GuestAllergens>) {
  return (
    <Suspense fallback={null}>
      <LazyGuest {...props} />
    </Suspense>
  );
}

export function TeamAllergens(props: ComponentProps<typeof Team.TeamAllergens>) {
  return (
    <Suspense fallback={null}>
      <LazyTeam {...props} />
    </Suspense>
  );
}
