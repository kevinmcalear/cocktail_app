import { Redirect, Stack } from 'expo-router';

import { BackBarLabels } from '@/components/backbar/BackBarLabels';
import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { WebHead } from '@/components/WebHead';
import { useVenueFeatures } from '@/hooks/useVenueFeatures';

/** Printable labels for the back bar: a card per zone with what lives there. */
export default function BackBarLabelsRoute() {
  const { ready, home, has } = useVenueFeatures();
  if (home) return <Redirect href="/discover" />;
  if (!ready) return null;
  if (!has('backBar')) return <Redirect href="/" />;
  return (
    <VenueBrandProvider>
      <Stack.Screen options={{ headerShown: false, title: 'Back bar labels' }} />
      <WebHead>
        <title>Back bar labels</title>
      </WebHead>
      <BackBarLabels />
    </VenueBrandProvider>
  );
}
