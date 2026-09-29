import { Stack } from 'expo-router';

import { ModerationScreen } from '@/components/screens/safety/ModerationScreen';

/** Settings › Reports, for moderators. */
export default function ModerationRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Reports' }} />
      <ModerationScreen />
    </>
  );
}
