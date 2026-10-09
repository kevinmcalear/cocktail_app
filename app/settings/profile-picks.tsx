import { Stack, useLocalSearchParams } from 'expo-router';

import { ProfilePicksScreen } from '@/components/screens/profile/ProfilePicks';
import type { ShareSection } from '@/lib/profiles';

const SECTIONS: readonly ShareSection[] = ['had', 'bars', 'originals'];

/** Settings › Public profile › Choose: which drinks, bars or originals show. */
export default function ProfilePicksRoute() {
  const { section } = useLocalSearchParams<{ section?: string }>();
  const picked = SECTIONS.find((s) => s === section) ?? 'had';
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'What your profile shows' }} />
      <ProfilePicksScreen section={picked} />
    </>
  );
}
