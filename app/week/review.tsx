import { Stack } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { ReviewImports } from '@/components/screens/week/ReviewImports';
import { WebHead } from '@/components/WebHead';

/** What the venue's calendars brought in, waiting for the team to share or keep. */
export default function WeekReview() {
  return (
    <VenueBrandProvider>
      <Stack.Screen options={{ headerShown: false, title: 'New from your calendars' }} />
      <WebHead>
        <title>New from your calendars</title>
      </WebHead>
      <ReviewImports />
    </VenueBrandProvider>
  );
}
