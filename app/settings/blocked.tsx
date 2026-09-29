import { Stack } from 'expo-router';

import { BlockedPeopleScreen } from '@/components/screens/safety/BlockedPeopleScreen';

/** Settings › Blocked people. */
export default function BlockedPeopleRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Blocked people' }} />
      <BlockedPeopleScreen />
    </>
  );
}
