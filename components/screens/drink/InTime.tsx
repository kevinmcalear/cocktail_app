import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { eraBands, eraX, threadSummary, type Dated } from '@/lib/timeline';

const PIN = 12;

/**
 * A drink's family line placed on the whole history of drinks, from the punch
 * bowl to now: a pin per dated step on an era strip, how long the line runs
 * and its longest jump, and a way into the History timeline with the line lit.
 * Hidden when fewer than two steps have a year.
 */
export function InTime({ line, focusId }: { line: Dated[]; focusId: string }) {
  const ds = useDs();
  const router = useRouter();
  const summary = threadSummary(line);
  const dated = line.filter((d) => d.year != null);
  if (!summary) return null;
  const first = dated[0].year!;
  const last = dated.at(-1)!.year!;
  return (
    <View style={[styles.card, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
      <View style={styles.head}>
        <Caption tone="muted" style={styles.eyebrow}>
          In time
        </Caption>
        <PressableScale
          role="link"
          accessibilityLabel="See it on the timeline"
          onPress={() => router.push({ pathname: '/history', params: { view: 'timeline', focus: focusId } })}
          style={styles.link}
        >
          <Caption color={ds.accentText}>See it on the timeline</Caption>
          <IconSymbol name="chevron.right" size={14} color={ds.accentText} />
        </PressableScale>
      </View>
      <View role="img" accessibilityLabel={dated.map((d) => `${d.name}, ${d.approx ? 'about ' : ''}${d.year}`).join('; ')} style={styles.strip}>
        <View style={styles.bands}>
          {eraBands().map((b) => (
            <View key={b.era.key} style={[styles.band, { flex: b.w, backgroundColor: ds.c.lineStrong }]} />
          ))}
        </View>
        <View style={[styles.span, { left: `${eraX(first) * 100}%`, width: `${(eraX(last) - eraX(first)) * 100}%`, backgroundColor: ds.accentText }]} />
        {dated.map((d, i) => (
          <View
            key={`${d.name}-${i}`}
            style={[styles.pin, { left: `${eraX(d.year!) * 100}%`, backgroundColor: i === dated.length - 1 ? ds.c.ink : ds.accentText, borderColor: ds.c.surface }]}
          />
        ))}
        <Caption tone="muted" style={[styles.year, styles.firstYear]}>
          {first}
        </Caption>
        <Caption tone="muted" style={[styles.year, styles.lastYear]}>
          {last}
        </Caption>
      </View>
      <Body>{summary}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.card, borderCurve: 'continuous', paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { fontFamily: fontFamilies.mono, letterSpacing: 1.2, textTransform: 'uppercase' },
  link: { minHeight: layout.minTapTarget, flexDirection: 'row', alignItems: 'center', gap: space.xs },
  strip: { height: PIN + space.xl, marginHorizontal: PIN / 2 },
  bands: { position: 'absolute', top: PIN / 2 - 2, left: 0, right: 0, height: 4, flexDirection: 'row', gap: 2 },
  band: { borderRadius: radius.pill },
  span: { position: 'absolute', top: PIN / 2 - 2, height: 4, opacity: 0.5, borderRadius: radius.pill },
  pin: { position: 'absolute', top: 0, width: PIN, height: PIN, marginLeft: -PIN / 2, borderRadius: radius.pill, borderWidth: 2 },
  year: { position: 'absolute', top: PIN + space.xs, fontFamily: fontFamilies.mono },
  firstYear: { left: -PIN / 2 },
  lastYear: { right: -PIN / 2 },
});
