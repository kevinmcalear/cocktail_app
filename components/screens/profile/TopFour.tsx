import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Caption, DrinkImage, DsText, Headline, PressableScale, Spec, TextLink, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import type { HadDrink } from '@/lib/hadDrinks';
import { itemHref } from '@/lib/itemRoutes';
import { formatScore } from '@/lib/ranking';

/** Four places, in pin order; a free or hidden place is null. */
export const fourSlots = (pinned: readonly HadDrink[]): (HadDrink | null)[] => [0, 1, 2, 3].map((i) => pinned[i] ?? null);

/**
 * "Top four" (ppl-you, ppl-person): four tiles in one row, each the drink's
 * picture, name and score; a free place says Empty. On You, Change opens the
 * picks. Nothing on someone else's page when they pinned none.
 */
export function TopFour({ slots, changeHref }: { slots: (HadDrink | null)[]; changeHref?: string }) {
  const ds = useDs();
  const router = useRouter();
  if (!changeHref && !slots.some(Boolean)) return null;
  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Headline role="heading">Top four</Headline>
        {changeHref ? <TextLink label="Change" accessibilityHint="Choose your top four" onPress={() => router.push(changeHref as Href)} /> : null}
      </View>
      <View role="list" style={styles.row}>
        {slots.map((d, i) =>
          d ? (
            <PressableScale
              key={d.id}
              role="link"
              accessibilityLabel={`${i + 1}. ${d.name}, score ${formatScore(d.score)}`}
              onPress={() => router.push(itemHref('Cocktail', d.itemId) as Href)}
              style={styles.tile}
            >
              <DrinkImage thumb source={d.imageUrl} generated={d.isSketch} itemId={d.itemId} accessibilityLabel={d.name} />
              <DsText variant="caption" numberOfLines={2}>
                {d.name}
              </DsText>
              <Spec>{formatScore(d.score)}</Spec>
            </PressableScale>
          ) : (
            <View key={`empty-${i}`} role="listitem" accessibilityLabel={`Place ${i + 1}, empty`} style={styles.tile}>
              <View style={[styles.empty, { borderColor: ds.c.lineStrong }]}>
                <Caption tone="muted">Empty</Caption>
              </View>
            </View>
          )
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', gap: space.sm },
  tile: { flex: 1, minWidth: 0, gap: space.xs },
  empty: { aspectRatio: 1, borderRadius: radius.control, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
});
