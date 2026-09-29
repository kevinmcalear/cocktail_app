import { Stack } from 'expo-router';

import { ClaimsReview } from '@/components/screens/profile/ClaimsReview';

/** Moderators approve or turn down profile claims. Not a valid handle, so it can't shadow /p/[id]. */
export default function ReviewClaimsRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ClaimsReview />
    </>
  );
}
