import { lazy, Suspense, useState, type ComponentProps } from 'react';

import type * as Note from './HandoverNote';
import type * as Write from './HandoverWrite';

const LazySheet = lazy(() => import('./HandoverNote').then((m) => ({ default: m.HandoverSheet })));
const LazyView = lazy(() => import('./HandoverNote').then((m) => ({ default: m.HandoverView })));
const LazyWrite = lazy(() => import('./HandoverWrite').then((m) => ({ default: m.HandoverWriteSheet })));

/**
 * On the web the handover note, its sheet and the writing sheet load when
 * first opened, not with Tonight (the home page): its first load carries only
 * the card. Once opened, the sheet stays mounted so it can close as usual.
 */
export function HandoverSheet(props: ComponentProps<typeof Note.HandoverSheet>) {
  const [opened, setOpened] = useState(props.visible);
  if (props.visible && !opened) setOpened(true);
  if (!opened) return null;
  return (
    <Suspense fallback={null}>
      <LazySheet {...props} />
    </Suspense>
  );
}

export function HandoverView(props: ComponentProps<typeof Note.HandoverView>) {
  return (
    <Suspense fallback={null}>
      <LazyView {...props} />
    </Suspense>
  );
}

export function HandoverWriteSheet(props: ComponentProps<typeof Write.HandoverWriteSheet>) {
  return (
    <Suspense fallback={null}>
      <LazyWrite {...props} />
    </Suspense>
  );
}
