import { Stack } from 'expo-router';

import { AllergiesScreen } from '@/components/screens/settings/AllergiesScreen';

/** Settings › Allergies. Opens signed out too: the list stays on this phone until you sign in. */
export default function AllergiesRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Your allergies' }} />
      <AllergiesScreen />
    </>
  );
}
