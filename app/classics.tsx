import { Redirect, Stack } from 'expo-router';

import { MatchClassicsScreen } from '@/components/screens/classics/MatchClassicsScreen';
import { useMode } from '@/hooks/useMode';

/** Match the active venue's drinks to catalog classics. Opened from Library, so not at home. */
export default function ClassicsRoute() {
  if (useMode().mode === 'home') return <Redirect href="/discover" />;
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Match to classics' }} />
      <MatchClassicsScreen />
    </>
  );
}
