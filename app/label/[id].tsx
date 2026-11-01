import { Stack, useLocalSearchParams } from 'expo-router';
import { lazy, Suspense } from 'react';

import type { LabelParams } from '@/components/screens/label/LabelScreen';
import { WebHead } from '@/components/WebHead';

// The screen loads with this route only, so its imports don't count toward the every-page chunk (B13).
const LabelScreen = lazy(() => import('@/components/screens/label/LabelScreen').then((m) => ({ default: m.LabelScreen })));

/** A batch's label: `/label/<batch id>`, with `?item&amount&unit&made` when it was just logged (labelHref). */
export default function LabelRoute() {
  const params = useLocalSearchParams<Omit<LabelParams, 'id'> & { id: string }>();
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Label' }} />
      <WebHead>
        <title>Label</title>
      </WebHead>
      <Suspense fallback={null}>
        <LabelScreen {...params} />
      </Suspense>
    </>
  );
}
