import { Redirect, Stack } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { WeekScreen } from '@/components/screens/week/WeekScreen';
import { WebHead } from '@/components/WebHead';
import { useVenueFeatures } from '@/hooks/useVenueFeatures';

/** This week: the venue's next seven days (with Tonight switched on), or at home the bars you love and your own menus. */
export default function Week() {
  const { ready, has } = useVenueFeatures();
  if (!ready) return null;
  if (!has('tonight')) return <Redirect href="/" />;
  return (
    <VenueBrandProvider>
      <Stack.Screen options={{ headerShown: false, title: 'This week' }} />
      <WebHead>
        <title>This week</title>
      </WebHead>
      <WeekScreen />
    </VenueBrandProvider>
  );
}
