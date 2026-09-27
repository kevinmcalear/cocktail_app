import { Stack } from 'expo-router';

import { ClaimsReview } from '@/components/screens/profile/ClaimsReview';
import { NotInPreview } from '@/components/screens/profile/ProfileScreen';
import { useRedesign } from '@/lib/flags';

/** Moderators approve or turn down profile claims. Not a valid handle, so it can't shadow /p/[id]. */
export default function ReviewClaimsRoute() {
  const redesign = useRedesign();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {redesign ? <ClaimsReview /> : <NotInPreview />}
    </>
  );
}
