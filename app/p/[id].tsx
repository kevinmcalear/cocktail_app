import { Stack, useLocalSearchParams } from 'expo-router';

import { NotInPreview, ProfileScreen } from '@/components/screens/profile/ProfileScreen';
import { useRedesign } from '@/lib/flags';

/** A public profile, by id or handle: /p/<uuid> or /p/juniper.jo. Redesign only. */
export default function ProfileRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const redesign = useRedesign();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {redesign ? <ProfileScreen profileRef={id} /> : <NotInPreview />}
    </>
  );
}
