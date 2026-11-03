import { lazy, Suspense, type ComponentProps } from 'react';

import type * as Door from './StaffDoor';

const LazyDoor = lazy(() => import('./StaffDoor').then((m) => ({ default: m.StaffDoor })));

/*
 * Only a claimed bar's page shows the staff door ("Work here? Ask to join"),
 * so on the web it loads from its own chunk and the bar page's first load
 * (quality budget B13, /p/[id]) doesn't carry the join hooks.
 */
export function StaffDoor(props: ComponentProps<typeof Door.StaffDoor>) {
  return (
    <Suspense fallback={null}>
      <LazyDoor {...props} />
    </Suspense>
  );
}
