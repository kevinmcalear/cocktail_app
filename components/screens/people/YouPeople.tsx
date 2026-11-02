import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Surface } from '@/components/ds';
import { RowDivider, SettingsRow } from '@/components/screens/settings/SettingsParts';
import { TonightLabel } from '@/components/screens/tonight/TonightParts';
import { space } from '@/constants/tokens';
import { useFollowers, useFollowing, usePeopleByUser } from '@/hooks/useFollows';
import { namesLine } from '@/lib/follows';

/**
 * People on You (Kept-people, You · People): Following with the first names
 * and the count, Followers that only you see, and Find people beside the label.
 */
export function YouPeople() {
  const router = useRouter();
  const following = useFollowing().data;
  const followers = useFollowers().data;
  const names = usePeopleByUser(following?.slice(0, 2)).data ?? [];
  const followingLine = following?.length
    ? namesLine(
        names.map((p) => p.name),
        following.length,
      )
    : 'Nobody yet';
  return (
    <View style={styles.section}>
      <TonightLabel title="People" aside="Find people" onAside={() => router.push('/people/find' as Href)} />
      <Surface style={styles.card}>
        <SettingsRow icon="person.2.fill" label="Following" detail={followingLine ?? undefined} value={following ? String(following.length) : undefined} onPress={() => router.push('/people' as Href)} />
        <RowDivider />
        <SettingsRow icon="person.badge.plus" label="Followers" detail="Only you see these" value={followers ? String(followers.length) : undefined} onPress={() => router.push('/people?tab=followers' as Href)} />
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  card: { paddingVertical: space.xs },
});
