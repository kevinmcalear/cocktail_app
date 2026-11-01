import { Stack, useLocalSearchParams } from 'expo-router';

import { GuestSaysScreen } from '@/components/screens/scores/GuestSaysScreen';

/** What guests say about one of a bar's drinks (Loop-reasons), from its page's At the bar rows. */
export default function GuestSaysRoute() {
  const { itemId, name, bar } = useLocalSearchParams<{ itemId: string; name?: string; bar?: string }>();
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'What guests say' }} />
      <GuestSaysScreen itemId={itemId} name={name} barName={bar} />
    </>
  );
}
