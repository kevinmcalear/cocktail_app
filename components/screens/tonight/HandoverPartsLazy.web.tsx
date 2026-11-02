import { lazy, Suspense, useState, type ComponentProps } from 'react';

import type * as Parts from './Handover';

const Lazy = lazy(() => import('./Handover').then((m) => ({ default: m.HandoverPart })));

/**
 * On the web the handover's parts load the first time one has something to
 * show (NightHandover.tsx places each only then), not with Tonight, the home
 * page: a bar with no note this week never loads them. The sheets load on
 * first open, then stay mounted so they can close as usual.
 */
export function HandoverPart(props: ComponentProps<typeof Parts.HandoverPart>) {
  const { which, s } = props;
  const open = which !== 'sheets' || (s.reading && !s.wide) || !!s.writing;
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);
  if (!opened) return null;
  return (
    <Suspense fallback={null}>
      <Lazy {...props} />
    </Suspense>
  );
}
