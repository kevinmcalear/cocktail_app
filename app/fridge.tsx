import { Stack } from 'expo-router';
import { lazy, Suspense } from 'react';

import { WebHead } from '@/components/WebHead';

// The screen loads with this route only, so its imports don't count toward the every-page chunk (B13).
const FridgeScreen = lazy(() => import('@/components/screens/label/FridgeScreen').then((m) => ({ default: m.FridgeScreen })));

/** In the fridge: the bar's house-made by the day each batch was made (Bet-labels). */
export default function FridgeRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'In the fridge' }} />
      <WebHead>
        <title>In the fridge</title>
      </WebHead>
      <Suspense fallback={null}>
        <FridgeScreen />
      </Suspense>
    </>
  );
}
