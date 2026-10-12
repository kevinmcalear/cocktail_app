import { Stack, useLocalSearchParams } from 'expo-router';

import { PageVisibilityScreen } from '@/components/screens/publishing/PageVisibilityScreen';

/** Venue settings › Publishing › Who sees your page. */
export default function PageVisibilityRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <PageVisibilityScreen barId={id} />
    </>
  );
}
