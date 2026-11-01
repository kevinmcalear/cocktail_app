import { Stack } from 'expo-router';

import { MyDrinksScreen } from '@/components/screens/scores/MyDrinksScreen';

/** What guests say about the drinks credited to you (Loop-reasons "Your drinks"). */
export default function MyDrinksRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Your drinks' }} />
      <MyDrinksScreen />
    </>
  );
}
