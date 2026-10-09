import { Redirect, Stack, useLocalSearchParams } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { BackBarScreen } from '@/components/screens/BackBarScreen';
import { WebHead } from '@/components/WebHead';
import { useMode } from '@/hooks/useMode';

/**
 * The back bar map. `?place=<item id>&name=<item name>` opens it
 * ready to place that item (from the ingredient page's "Where it lives").
 * A venue's map, so not at home.
 */
export default function BackBar() {
  const { place, name } = useLocalSearchParams<{ place?: string; name?: string }>();
  if (useMode().mode === 'home') return <Redirect href="/discover" />;
  return (
    <VenueBrandProvider>
      <Stack.Screen options={{ headerShown: false, title: 'Back bar' }} />
      <WebHead>
        <title>Back bar</title>
      </WebHead>
      <BackBarScreen placeItem={place && name ? { id: place, name } : undefined} />
    </VenueBrandProvider>
  );
}
