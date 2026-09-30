import { Stack, useLocalSearchParams } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { BackBarScreen } from '@/components/screens/BackBarScreen';
import { WebHead } from '@/components/WebHead';

/**
 * The back bar map. `?place=<item id>&name=<item name>` opens it
 * ready to place that item (from the ingredient page's "Where it lives").
 */
export default function BackBar() {
  const { place, name } = useLocalSearchParams<{ place?: string; name?: string }>();
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
