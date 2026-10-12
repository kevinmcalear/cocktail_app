import { Stack } from 'expo-router';

import { AboutYouScreen } from '@/components/screens/profile/AboutYouScreen';

/** Settings › Public profile › About you. */
export default function ProfileAboutRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'About you' }} />
      <AboutYouScreen />
    </>
  );
}
