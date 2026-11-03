import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ListGroup, ListRow, SectionLabel } from '@/components/ds/ListGroup';
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
      <SectionLabel title="People" aside="Find people" onAside={() => router.push('/people/find' as Href)} />
      <ListGroup>
        <ListRow first icon="person.2.fill" title="Following" detail={followingLine} value={following ? String(following.length) : undefined} onPress={() => router.push('/people' as Href)} />
        <ListRow icon="person.badge.plus" title="Followers" detail="Only you see these" value={followers ? String(followers.length) : undefined} onPress={() => router.push('/people?tab=followers' as Href)} />
      </ListGroup>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
});
