import { Redirect, Stack } from 'expo-router';

import { BackBarLabels } from '@/components/backbar/BackBarLabels';
import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { WebHead } from '@/components/WebHead';
import { useMode } from '@/hooks/useMode';

/** Printable labels for the back bar: a card per zone with what lives there. */
export default function BackBarLabelsRoute() {
  // Parked (31 Oct): nothing links here any more, but the map and its data stay.
  const { mode } = useMode();
  if (mode === 'home') return <Redirect href="/discover" />;
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
