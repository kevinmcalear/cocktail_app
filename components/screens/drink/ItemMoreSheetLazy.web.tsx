import { lazy, Suspense, useState, type ComponentProps } from 'react';

import type { ItemMoreSheet as Sheet } from './ItemMoreSheet';

const Lazy = lazy(() => import('./ItemMoreSheet').then((m) => ({ default: m.ItemMoreSheet })));

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
