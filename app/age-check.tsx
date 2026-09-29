import { Stack } from 'expo-router';

import { AgeCheckScreen } from '@/components/screens/safety/AgeCheckScreen';

/** After sign-up: the age check, once. */
export default function AgeCheckRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Age check' }} />
      <AgeCheckScreen />
    </>
  );
}
