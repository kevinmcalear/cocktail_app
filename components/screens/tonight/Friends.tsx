import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DsText, PressableScale, Surface, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { displayFaces, radius, space } from '@/constants/tokens';
import { useFollowing, useFriendsRanks, type FriendRank } from '@/hooks/useFollows';
import { friendRankLines } from '@/lib/follows';
import { itemHref } from '@/lib/itemRoutes';
import { formatScore } from '@/lib/ranking';

import { TonightSection } from './TonightParts';

/** How many friends' ranks Tonight shows. */
const SHOWN = 3;

/**
 * Friends on Tonight at home (Kept-follow): what people you follow ranked
 * lately, as they share it ("Sam ranked a Penicillin · Caretaker's · now
 * Sam's best sour · 9.1"), with People beside the label. `ranks` is the
 * filled section, which leads the page; `prompt` is the one for someone who
 * follows nobody yet, after the shelf. Following people who've shared
 * nothing lately shows neither.
 */
export function useFriends() {
  const ranks = useFriendsRanks(SHOWN).data ?? [];
  const following = useFollowing();
  return { ranks, followsNobody: following.isSuccess && following.data.length === 0 };
}

export function Friends({ ranks }: { ranks: FriendRank[] }) {
  const router = useRouter();
  if (!ranks.length) return null;
  return (
    <TonightSection title="Friends" aside="People" onAside={() => router.push('/people' as Href)}>
      <View role="list">
        {ranks.map((r, i) => (
          <FriendRow key={r.entryId} rank={r} first={i === 0} />
        ))}
      </View>
    </TonightSection>
  );
}

/** Nobody followed yet: what following does, and Find people. */
export function FriendsPrompt() {
  const ds = useDs();
  const router = useRouter();
  return (
    <TonightSection title="Friends">
      <Surface raised style={styles.prompt}>
        <View style={[styles.icon, { backgroundColor: ds.c.ground }]}>
          <IconSymbol name="person.badge.plus" size={20} color={ds.c.ink} />
        </View>
        <View style={styles.flex}>
          <Body>Follow people whose taste you trust</Body>
          <Caption tone="muted">Their new ranks show here. Nobody else sees who you follow.</Caption>
          <Button label="Find people" size="sm" onPress={() => router.push('/people/find' as Href)} style={styles.start} />
        </View>
      </Surface>
    </TonightSection>
  );
}

function FriendRow({ rank: r, first }: { rank: FriendRank; first: boolean }) {
  const ds = useDs();
  const router = useRouter();
  const { title, sub } = friendRankLines(r, new Date());
  const score = formatScore(r.score);
  return (
    <PressableScale
      role="link"
      accessibilityLabel={`${title}. ${sub}. ${score}`}
      onPress={() => (r.itemId ? router.push(itemHref('Cocktail', r.itemId) as Href) : undefined)}
      style={[styles.row, { borderTopColor: first ? 'transparent' : ds.c.line, borderBottomColor: ds.c.line }]}
    >
      <UserAvatar uri={r.avatarUrl} name={r.displayName} size={40} />
      <View style={styles.flex}>
        <DsText variant="body" numberOfLines={1}>
          {title}
        </DsText>
        {sub ? (
          <Caption tone="muted" numberOfLines={1}>
            {sub}
          </Caption>
        ) : null}
      </View>
      <DsText variant="headline" style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
        {score}
      </DsText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1, minWidth: 0, gap: space.xs },
  prompt: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, padding: space.lg, borderRadius: radius.card },
  icon: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  start: { alignSelf: 'flex-start', marginTop: space.sm },
});
