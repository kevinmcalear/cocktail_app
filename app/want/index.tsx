import { Stack } from 'expo-router';

import { WantListScreen } from '@/components/screens/want/WantListScreen';

/** Your Want list (Loop-want "The Want list"). */
export default function WantRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Want' }} />
      <WantListScreen />
    </>
  );
}
