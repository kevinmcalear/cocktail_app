import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { lazy, Suspense } from 'react';

import { isSheetKind, SHEETS } from '@/components/screens/print/sheets';
import { WebHead } from '@/components/WebHead';

// The screen loads with this route only, so its imports don't count toward the every-page chunk (B13).
const PrintPreview = lazy(() => import('@/components/screens/print/PrintPreview').then((m) => ({ default: m.PrintPreview })));

/** One sheet of the print set to look at and print: `/print/<list|run|spec|study|table|poster>?menu=<id>`, `&print=1` to print at once. */
export default function PrintSheetRoute() {
  const { sheet, menu } = useLocalSearchParams<{ sheet: string; menu?: string }>();
  if (!menu || !isSheetKind(sheet)) return <Redirect href="/" />;
  const kind = sheet;
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: SHEETS[kind].label }} />
      <WebHead>
        <title>{SHEETS[kind].label}</title>
      </WebHead>
      <Suspense fallback={null}>
        <PrintPreview menuId={menu} kind={kind} />
      </Suspense>
    </>
  );
}
