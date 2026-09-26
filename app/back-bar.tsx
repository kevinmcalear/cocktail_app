import { Redirect, Stack, useLocalSearchParams } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { BackBarScreen } from '@/components/screens/BackBarScreen';
import { WebHead } from '@/components/WebHead';
import { useRedesign } from '@/lib/flags';

/**
 * The back bar map. Redesign only. `?place=<item id>&name=<item name>` opens it
 * ready to place that item (from the ingredient page's "Where it lives").
 */
export default function BackBar() {
  const redesign = useRedesign();
  const { place, name } = useLocalSearchParams<{ place?: string; name?: string }>();
  if (!redesign) return <Redirect href="/" />;
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
