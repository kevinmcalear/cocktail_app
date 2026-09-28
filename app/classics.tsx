import { Redirect, Stack } from 'expo-router';

import { MatchClassicsScreen } from '@/components/screens/classics/MatchClassicsScreen';
import { useRedesign } from '@/lib/flags';

/** Match the active venue's drinks to catalog classics. Redesign only; opened from Library. */
export default function ClassicsRoute() {
  const redesign = useRedesign();
  if (!redesign) return <Redirect href="/" />;
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Match to classics' }} />
      <MatchClassicsScreen />
    </>
  );
}
