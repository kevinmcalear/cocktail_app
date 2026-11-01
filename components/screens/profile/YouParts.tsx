import { useRouter, type Href } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Caption, DrinkImage, DsText, GlassButton, PressableScale, useDs, useGutter } from '@/components/ds';
import { RowName } from '@/components/ds/ListGroup';
import { displayFaces, space } from '@/constants/tokens';
import { whereLine, type HadDrink } from '@/lib/hadDrinks';
import { formatScore } from '@/lib/ranking';

import { TabHeader } from './TabHeader';

/** The gear, You's only control (Prod-you). */
export function SettingsGear() {
  const router = useRouter();
  return <GlassButton accessibilityLabel="Settings" icon="place.settings" onPress={() => router.push('/settings')} />;
}

/**
 * You's top: the gear alone (Prod-you). `place`: the states' header, with the
 * place button (Sta-you). Android keeps its search bar either way.
 */
export function YouTop({ place = false }: { place?: boolean }) {
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const gear = (
    <View style={[styles.top, { paddingTop: insets.top + space.sm, paddingHorizontal: gutter }]}>
      <SettingsGear />
    </View>
  );
  if (!place && Platform.OS !== 'android') return gear;
  return <TabHeader fallback={gear} add={false} actions={<SettingsGear />} />;
}

/** "48 ranked", "12 bars loved", "9 made by you", side by side with a hairline between (Prod-you). */
export function YouStats({ stats }: { stats: readonly { n: number; label: string }[] }) {
  const ds = useDs();
  const face = { fontFamily: displayFaces[ds.displayFace].regular };
  return (
    <View style={styles.stats}>
      {stats.map((s, i) => (
        <View
          key={s.label}
          aria-label={`${s.n} ${s.label}`}
          style={[
            styles.stat,
            i
              ? {
                  borderLeftWidth: StyleSheet.hairlineWidth,
                  borderLeftColor: ds.c.line,
                }
              : null,
          ]}
        >
          <DsText variant="title" align="center" style={face}>
            {String(s.n)}
          </DsText>
          <Caption tone="muted" align="center" numberOfLines={1}>
            {s.label}
          </Caption>
        </View>
      ))}
    </View>
  );
}

/** Your best: your top drinks, each with its place, drawing, where you had it and your score (Prod-you). */
export function BestRows({ drinks }: { drinks: readonly HadDrink[] }) {
  const ds = useDs();
  const router = useRouter();
  const face = { fontFamily: displayFaces[ds.displayFace].regular };
  return (
    <View role="list" style={styles.best}>
      {drinks.map((d, i) => {
        const where = whereLine(d);
        return (
          <View role="listitem" key={d.id}>
            <PressableScale role="link" accessibilityLabel={`${i + 1}. ${d.name}, ${where}, score ${formatScore(d.score)}`} onPress={() => router.push(`/cocktail/${d.itemId}` as Href)} style={styles.bestRow}>
              <DsText variant="headline" tone="muted" style={[face, styles.place]}>
                {String(i + 1)}
              </DsText>
              <DrinkImage thumb sketchDetail="thumb" itemId={d.itemId} accessibilityLabel={d.name} radius="control" style={styles.drawing} />
              <View style={styles.words}>
                <RowName>{d.name}</RowName>
                <Caption tone="muted" numberOfLines={1}>
                  {where}
                </Caption>
              </View>
              <DsText variant="headline" style={face}>
                {formatScore(d.score)}
              </DsText>
            </PressableScale>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'flex-end' },
  stats: { flexDirection: 'row' },
  stat: { flex: 1, gap: space.xs, paddingHorizontal: space.sm },
  best: { gap: space.xs },
  bestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 64,
  },
  place: { width: 26 },
  drawing: { width: 56 },
  words: { flex: 1, minWidth: 0 },
});
