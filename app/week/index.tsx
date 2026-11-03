import { Stack } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { WeekScreen } from '@/components/screens/week/WeekScreen';
import { WebHead } from '@/components/WebHead';
import { FeatureGate } from '@/components/nav/FeatureGate';

/** This week: the venue's next seven days, or at home the bars you love and your own menus. */
export default function Week() {
  return (
    <FeatureGate feature="tonight">
      <VenueBrandProvider>
        <Stack.Screen options={{ headerShown: false, title: 'This week' }} />
        <WebHead>
          <title>This week</title>
        </WebHead>
        <WeekScreen />
      </VenueBrandProvider>
    </FeatureGate>
  );
}
