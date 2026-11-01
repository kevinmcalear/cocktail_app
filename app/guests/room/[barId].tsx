import { Stack, useLocalSearchParams } from 'expo-router';

import { RoomScreen } from '@/components/screens/scores/RoomScreen';

/** What guests say about a bar and its room (Kept-score), for its Admins, from the score on its page. */
export default function RoomRoute() {
  const { barId, name } = useLocalSearchParams<{ barId: string; name?: string }>();
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'What guests say' }} />
      <RoomScreen barId={barId} barName={name} />
    </>
  );
}
