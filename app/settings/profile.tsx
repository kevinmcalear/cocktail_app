import { Stack } from 'expo-router';

import { MyProfileScreen } from '@/components/screens/profile/MyProfileScreen';

/** Settings › Public profile. */
export default function MyProfileRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Your public profile' }} />
      <MyProfileScreen />
    </>
  );
}
