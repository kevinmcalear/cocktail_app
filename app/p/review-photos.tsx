import { Stack } from 'expo-router';

import { MakerPhotosReview } from '@/components/screens/maker/MakerPhotosReview';

/** Moderators check a brand's first bottle photos. Not a valid handle, so it can't shadow /p/[id]. */
export default function ReviewPhotosRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <MakerPhotosReview />
    </>
  );
}
