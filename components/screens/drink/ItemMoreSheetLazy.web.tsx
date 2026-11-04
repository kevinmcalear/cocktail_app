import { lazy, Suspense, useState, type ComponentProps } from 'react';

import type { ItemMoreSheet as Sheet } from './ItemMoreSheet';

const load = () => import('./ItemMoreSheet');
// Offline, or a tab older than the last deploy: try once more, then the … does nothing rather than the page's error screen.
// ponytail: a failed load stays failed until a reload; a retry on the next tap would need a fresh lazy().
const Lazy = lazy(() =>
  load()
    .catch(load)
    .then((m) => ({ default: m.ItemMoreSheet }))
    .catch(() => ({ default: (() => null) as unknown as typeof Sheet })),
);

/**
 * On the web the … sheet (its rows, header and scroll) loads when the … is
 * first tapped, not with every page that shows the button (a shared menu, B13).
 */
export function ItemMoreSheet(props: ComponentProps<typeof Sheet>) {
  const [opened, setOpened] = useState(props.visible);
  if (props.visible && !opened) setOpened(true);
  if (!opened) return null;
  return (
    <Suspense fallback={null}>
      <Lazy {...props} />
    </Suspense>
  );
}
