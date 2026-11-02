import { lazy, Suspense, useState, type ComponentProps } from 'react';

import type * as Sheet from './DeleteVenueSheet';

const Lazy = lazy(() => import('./DeleteVenueSheet').then((m) => ({ default: m.DeleteVenueSheet })));

/**
 * On the web the delete-venue sheet loads the first time it opens, then
 * stays mounted so it can slide away. The banner that opens it is in every
 * page's header, and each page carried its own copy (quality budget B12).
 */
export function DeleteVenueSheet(props: ComponentProps<typeof Sheet.DeleteVenueSheet>) {
  const [opened, setOpened] = useState(false);
  if (props.visible && !opened) setOpened(true);
  if (!opened) return null;
  return (
    <Suspense fallback={null}>
      <Lazy {...props} />
    </Suspense>
  );
}
