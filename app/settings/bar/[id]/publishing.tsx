import { Stack, useLocalSearchParams } from 'expo-router';

import { PublishingScreen } from '@/components/screens/publishing/PublishingScreen';

/** A venue's publishing settings: the bar's default and each menu's. */
export default function PublishingRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <PublishingScreen barId={id} />
    </>
  );
}
