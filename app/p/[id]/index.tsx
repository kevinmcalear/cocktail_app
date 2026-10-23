import { Redirect, Stack, useLocalSearchParams } from 'expo-router';

import { ProfileScreen } from '@/components/screens/profile/ProfileScreen';
import { useMergedHandle, useProfile } from '@/hooks/useProfiles';

/** A public profile, by id or handle: /p/<uuid> or /p/juniper.jo. */
export default function ProfileRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // A seeded page someone claimed was merged into theirs: its old links go there (20261103300000).
  const { data: profile, isSuccess } = useProfile(id);
  const merged = useMergedHandle(id, isSuccess && !profile);
  if (merged.data) return <Redirect href={{ pathname: '/p/[id]', params: { id: merged.data } }} />;
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ProfileScreen profileRef={id} checking={merged.isFetching} />
    </>
  );
}
