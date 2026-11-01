import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Caption, DsText, PressableScale, useDs } from '@/components/ds';
import { displayFaces, radius, space } from '@/constants/tokens';
import { useFriendsRanks, type FriendRank } from '@/hooks/useFollows';
import { itemHref } from '@/lib/itemRoutes';
import { formatScore } from '@/lib/ranking';

import { TonightSection } from './TonightParts';

/** How many friends' ranks Tonight shows. */
const SHOWN = 3;

/**
 * Friends (Prod-today-home): what people you follow ranked lately, as they
 * share it: "Sam ranked a Penicillin · Caretaker's · now Sam's best sour ·
 * 9.1". Nothing when you follow nobody or they've shared nothing lately.
 */
export function Friends() {
  const ranks = useFriendsRanks(SHOWN).data ?? [];
  if (!ranks.length) return null;
  return (
    <TonightSection title="Friends">
      <View role="list">
        {ranks.map((r, i) => (
          <FriendRow key={r.entryId} rank={r} first={i === 0} />
        ))}
      </View>
    </TonightSection>
  );
}

function FriendRow({ rank: r, first }: { rank: FriendRank; first: boolean }) {
  const ds = useDs();
  const router = useRouter();
  const name = r.displayName.split(' ')[0];
  const title = `${name} ranked ${/^[aeiou]/i.test(r.name) ? 'an' : 'a'} ${r.name}`;
  const sub = [r.venueName, r.bestInFamily && r.drinkFamily ? `now ${name}’s best ${r.drinkFamily.toLowerCase()}` : null].filter(Boolean).join(' · ');
  const score = formatScore(r.score);
  return (
    <PressableScale
      role="link"
      accessibilityLabel={`${title}. ${sub}. ${score}`}
      onPress={() => (r.itemId ? router.push(itemHref('Cocktail', r.itemId) as Href) : undefined)}
      style={[styles.row, { borderTopColor: first ? 'transparent' : ds.c.line, borderBottomColor: ds.c.line }]}
    >
      <View style={[styles.mark, { backgroundColor: ds.c.raised }]}>
        <DsText variant="headline">{name.charAt(0)}</DsText>
      </View>
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
  mark: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
});
