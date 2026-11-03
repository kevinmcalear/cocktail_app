import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { lazy, Suspense } from 'react';

import type { LabelParams } from '@/components/screens/label/LabelScreen';
import { WebHead } from '@/components/WebHead';

// The screen loads with this route only, so its imports don't count toward the every-page chunk (B13).
const LabelScreen = lazy(() => import('@/components/screens/label/LabelScreen').then((m) => ({ default: m.LabelScreen })));

/**
 * A batch's label: `/label?batch=<batch id>`, with `&item&amount&unit&made`
 * when it was just logged (labelHref). A query, not a path, so the web needs
 * no rewrite for it.
 */
export default function LabelRoute() {
  const { batch, ...params } = useLocalSearchParams<Omit<LabelParams, 'id'> & { batch?: string }>();
  if (!batch) return <Redirect href="/" />;
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Label' }} />
      <WebHead>
        <title>Label</title>
      </WebHead>
      <Suspense fallback={null}>
        <LabelScreen id={batch} {...params} />
      </Suspense>
    </>
  );
}
