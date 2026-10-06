import { Stack, useLocalSearchParams } from 'expo-router';

import { ProfileScreen } from '@/components/screens/profile/ProfileScreen';

/** A public profile, by id or handle: /p/<uuid> or /p/juniper.jo. */
export default function ProfileRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ProfileScreen profileRef={id} />
    </>
  );
}
