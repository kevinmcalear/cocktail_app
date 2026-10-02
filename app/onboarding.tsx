import { Stack } from 'expo-router';

import { OnboardingScreen } from '@/components/screens/onboarding/OnboardingScreen';

/** After the age check, once, for a new account. */
export default function OnboardingRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Welcome' }} />
      <OnboardingScreen />
    </>
  );
}
