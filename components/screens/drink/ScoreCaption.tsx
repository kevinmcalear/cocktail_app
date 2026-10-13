import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Caption, DsText, PressableScale, Spec, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { useDrinkScore } from '@/hooks/useDrinkScore';
import { formatScore } from '@/lib/ranking';

/**
 * Under the credit: the drink's score and where it places ("8.9 · #2 in
 * Fitzroy · 146 ranked"), opening its rankings. The canvas draws only the
 * chip (12 Oct: the canvas wins over decision b13); a drink nobody has
 * scored yet keeps a Rankings pill, so the way in never disappears.
 */
export function ScoreCaption({ itemId, name }: { itemId: string; name: string }) {
  const ds = useDs();
  const router = useRouter();
  const score = useDrinkScore(itemId);
  const open = () => router.push(`/rankings/${itemId}`);
  const place = score?.position && score.area ? `#${score.position} in ${score.area}` : null;
  return (
    <View style={styles.row}>
      {score ? (
        <PressableScale
          role="link"
          accessibilityLabel={`Score ${formatScore(score.score)}${place ? `, number ${score.position} ${name} in ${score.area}` : ''}, ${score.rankers} ranked. Open the rankings`}
          onPress={open}
          style={[styles.pill, { backgroundColor: ds.c.surface, borderColor: ds.c.lineStrong }]}
        >
          <Spec>{formatScore(score.score)}</Spec>
          <Caption tone="muted">·</Caption>
          {place ? <DsText>{place}</DsText> : null}
          <Caption tone="muted">{`${score.rankers} ranked`}</Caption>
        </PressableScale>
      ) : null}
      {score ? null : (
        <PressableScale role="link" accessibilityLabel={`Rankings for ${name}`} onPress={open} style={[styles.pill, { backgroundColor: ds.c.surface, borderColor: ds.c.lineStrong }]}>
          <IconSymbol name="trophy" size={16} color={ds.c.ink} />
          <Caption style={styles.strong}>Rankings</Caption>
        </PressableScale>
      )}
    </View>
  );
}

/**
 * The score alone, small in mono, at the end of the credit line on the first
 * screen (Kevin, 13 Oct): it opens the rankings like the caption does. Nothing
 * until someone has scored the drink; the full caption stays under More.
 */
export function ScoreMark({ itemId, name }: { itemId: string; name: string }) {
  const router = useRouter();
  const score = useDrinkScore(itemId);
  if (!score) return null;
  return (
    <PressableScale
      role="link"
      accessibilityLabel={`Score ${formatScore(score.score)}, ${score.rankers} ranked. Open the rankings for ${name}`}
      onPress={() => router.push(`/rankings/${itemId}`)}
      hitSlop={MARK_SLOP}
    >
      <Spec>{formatScore(score.score)}</Spec>
    </PressableScale>
  );
}

// A 44 point target around the small mark, without making the credit line taller.
const MARK_SLOP = { top: 10, bottom: 10, left: 12, right: 12 };

const styles = StyleSheet.create({
  strong: { fontFamily: fontFamilies.bodySemiBold },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    minHeight: layout.minTapTarget,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
});
