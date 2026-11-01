import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { lazy, Suspense } from 'react';

import { WebHead } from '@/components/WebHead';

// The screen loads with this route only, so its imports don't count toward the every-page chunk (B13).
const PrintScreen = lazy(() => import('@/components/screens/print/PrintScreen').then((m) => ({ default: m.PrintScreen })));

/** Print, for a menu: `/print?menu=<menu id>` (the menu on now, from Tonight's Print tonight's list). */
export default function PrintRoute() {
  const { menu } = useLocalSearchParams<{ menu?: string }>();
  if (!menu) return <Redirect href="/" />;
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Print' }} />
      <WebHead>
        <title>Print</title>
      </WebHead>
      <Suspense fallback={null}>
        <PrintScreen menuId={menu} />
      </Suspense>
    </>
  );
}
