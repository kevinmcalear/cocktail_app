import { Stack } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { ReviewImports } from '@/components/screens/week/ReviewImports';
import { WebHead } from '@/components/WebHead';
import { FeatureGate } from '@/components/nav/FeatureGate';

/** What the venue's calendars brought in, waiting for the team to share or keep. */
export default function WeekReview() {
  return (
    <FeatureGate feature="tonight">
      <VenueBrandProvider>
        <Stack.Screen options={{ headerShown: false, title: 'New from your calendars' }} />
        <WebHead>
          <title>New from your calendars</title>
        </WebHead>
        <ReviewImports />
      </VenueBrandProvider>
    </FeatureGate>
  );
}
