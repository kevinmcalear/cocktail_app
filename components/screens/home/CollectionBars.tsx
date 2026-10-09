import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, Headline, PressableScale, useDs } from '@/components/ds';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { space } from '@/constants/tokens';
import { useLovedBars, type LovedBar } from '@/hooks/useKept';
import { useMyHadDrinks } from '@/hooks/useRankings';

const LOGO = 44;

function BarRow({ bar, line }: { bar: LovedBar; line: string | null }) {
  const ds = useDs();
  const router = useRouter();
  const detail = [bar.place, line].filter(Boolean).join(' · ');
  return (
    <PressableScale
      role="link"
      accessibilityLabel={`${bar.name}${detail ? `. ${detail}` : ''}`}
      onPress={() => router.push(`/p/${bar.handle || bar.id}` as Href)}
      style={[styles.row, { borderBottomColor: ds.c.line }]}
    >
      <UserAvatar uri={bar.avatarUrl} name={bar.name} size={LOGO} />
      <View style={styles.flex}>
        <Headline numberOfLines={1}>{bar.name}</Headline>
        {detail ? <Caption tone="muted">{detail}</Caption> : null}
      </View>
    </PressableScale>
  );
}

/**
 * Collection's Bars: the bars you love (the heart on a bar's page). The ones
 * you've had drinks at, with your count there, then the ones you want to go
 * to. Each says what it's pouring now, when we know.
 */
export function CollectionBars() {
  const { data: bars = [], isLoading, error } = useLovedBars();
  const had = useMyHadDrinks().data ?? [];
  if (error) return <Body tone="muted">Couldn’t load your bars. Try again in a moment.</Body>;
  if (isLoading) return null;
  if (!bars.length) return <Body tone="muted">Tap the heart on a bar’s page to keep it here, with what it’s pouring now.</Body>;

  const drinksAt = (id: string) => had.filter((h) => h.venue?.id === id).length;
  const now = (b: LovedBar) => (b.currentMenu ? `${b.currentMenu.name} on now` : null);
  const been = bars.filter((b) => drinksAt(b.id) > 0);
  const want = bars.filter((b) => drinksAt(b.id) === 0);
  return (
    <View style={styles.wrap}>
      {been.length ? (
        <View style={styles.section}>
          <Headline role="heading">Bars you love</Headline>
          <View role="list">
            {been.map((b) => (
              <View role="listitem" key={b.id}>
                <BarRow bar={b} line={[`${drinksAt(b.id)} had`, now(b)].filter(Boolean).join(' · ')} />
              </View>
            ))}
          </View>
        </View>
      ) : null}
      {want.length ? (
        <View style={styles.section}>
          <Headline role="heading">Want to go</Headline>
          <Caption tone="muted">Not been yet.</Caption>
          <View role="list">
            {want.map((b) => (
              <View role="listitem" key={b.id}>
                <BarRow bar={b} line={now(b)} />
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xl },
  section: { gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1, minWidth: 0 },
});
