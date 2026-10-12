import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Caption, DsText, Headline, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, fontFamilies, radius, space } from '@/constants/tokens';
import { useCollection } from '@/hooks/useCollection';
import { plural } from '@/lib/menus';

import { BarMark } from './BarMark';
import { CardGrid } from './CardGrid';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDay = (day: string) => {
  const [, m, d] = day.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
};

/**
 * Releases collected from bars, on Collection's Menus (b08): a card with the
 * bar's mark, when it came out, its name, how many drinks and how many your
 * shelf makes. Nothing when there are none.
 */
export function CollectionReleases({ canMakeIds }: { canMakeIds: Set<string> }) {
  const ds = useDs();
  const router = useRouter();
  const releases = useCollection().data?.releases ?? [];
  if (!releases.length) return null;
  return (
    <View style={styles.section}>
      <Headline role="heading">Releases</Headline>
      <Caption tone="muted" style={styles.note}>{`${plural(releases.length, 'release')} you collected from bars`}</Caption>
      <CardGrid min={360}>
        {releases.map((r) => {
          const ids = r.itemIds ?? [];
          const ready = ids.filter((id) => canMakeIds.has(id)).length;
          const when = [r.barName, r.releaseDate ? shortDay(r.releaseDate) : null, r.live ? null : 'No longer public'].filter(Boolean).join(' · ');
          const opens = r.live && r.releaseId;
          return (
            <PressableScale
              key={r.id}
              role={opens ? 'link' : undefined}
              disabled={!opens}
              accessibilityLabel={[r.name, when, ids.length ? `${plural(ids.length, 'drink')}, ${ready} of ${ids.length} ready to make` : null].filter(Boolean).join('. ')}
              onPress={() => opens && router.push(`/r/${r.releaseId}` as Href)}
              style={[styles.card, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}
            >
              <BarMark name={r.barName ?? r.name} size={52} />
              <View style={styles.text}>
                <Caption tone="muted">{when}</Caption>
                <DsText variant="headline" numberOfLines={2} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
                  {r.name}
                </DsText>
                <Caption>
                  {ids.length ? `Collected · ${plural(ids.length, 'drink')} · ` : 'Collected'}
                  {ids.length ? <DsText variant="caption" style={styles.mono}>{`${ready} / ${ids.length}`}</DsText> : null}
                </Caption>
              </View>
              {opens ? <IconSymbol name="chevron.right" size={16} color={ds.c.muted} /> : null}
            </PressableScale>
          );
        })}
      </CardGrid>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.xs },
  note: { marginBottom: space.sm },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md + 2, borderRadius: radius.card, borderWidth: 1 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  mono: { fontFamily: fontFamilies.monoMedium },
});
