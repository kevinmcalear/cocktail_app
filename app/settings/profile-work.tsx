import { Stack } from 'expo-router';

import { WorkScreen } from '@/components/screens/profile/WorkScreen';

/** Settings › Public profile › Work. */
export default function ProfileWorkRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Work' }} />
      <WorkScreen />
    </>
  );
}
