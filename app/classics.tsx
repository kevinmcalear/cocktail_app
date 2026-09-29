import { Stack } from 'expo-router';

import { MatchClassicsScreen } from '@/components/screens/classics/MatchClassicsScreen';

/** Match the active venue's drinks to catalog classics. Opened from Library. */
export default function ClassicsRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Match to classics' }} />
      <MatchClassicsScreen />
    </>
  );
}
