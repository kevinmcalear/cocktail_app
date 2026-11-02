import { Stack } from 'expo-router';

import { LearnScreen } from '@/components/screens/learn/LearnScreen';

/** Learn (Kept-learn): techniques, kit and pairings, on the stack of the tab it opened from (Discover, or Tonight for staff). */
export default function LearnRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Learn' }} />
      <LearnScreen />
    </>
  );
}
