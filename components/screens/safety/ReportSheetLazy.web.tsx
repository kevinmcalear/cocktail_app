import { lazy, Suspense } from 'react';

import type { ReportSheetProps } from './ReportSheet';

const Lazy = lazy(() => import('./ReportSheet').then((m) => ({ default: m.ReportSheet })));

/**
 * On the web the report sheet (its reasons and the safety hooks) loads when
 * Report is first tapped. Imported with every drink, bar and menu page, each
 * page carried its own copy (quality budget B12).
 */
export function ReportSheet(props: ReportSheetProps) {
  return (
    <Suspense fallback={null}>
      <Lazy {...props} />
    </Suspense>
  );
}
