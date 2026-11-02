import { lazy, Suspense, type ComponentProps } from 'react';

import type { ReportSheet as Sheet } from './ReportSheet';

const Lazy = lazy(() => import('./ReportSheet').then((m) => ({ default: m.ReportSheet })));

/**
 * On the web the report sheet (its reasons, the safety hooks and the menu
 * sheet it opens in) loads when Report is first tapped, not with a public
 * page that only shows the link (a shared menu, B13).
 */
export function ReportSheet(props: ComponentProps<typeof Sheet>) {
  return (
    <Suspense fallback={null}>
      <Lazy {...props} />
    </Suspense>
  );
}
