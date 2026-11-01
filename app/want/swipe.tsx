import { Stack, useLocalSearchParams } from 'expo-router';

import { WantSwipeScreen } from '@/components/screens/want/WantSwipeScreen';

/**
 * Want it? (Loop-want): swipe classics onto your Want list.
 * `?mode=onboarding&count=10` is onboarding's step: back, "3 of 10", "That's ten".
 */
export default function WantSwipeRoute() {
  const { mode, count } = useLocalSearchParams<{ mode?: string; count?: string }>();
  const n = Number(count);
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Want it?' }} />
      <WantSwipeScreen onboarding={mode === 'onboarding'} count={Number.isInteger(n) && n > 0 ? Math.min(n, 50) : undefined} />
    </>
  );
}
