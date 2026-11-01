import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Text as SvgText } from 'react-native-svg';

import { Body, Caption, Display, DsText, GlassButton, PressableScale, Title, useDs, useGutter } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { displayName, layout, radius, space, STATUS, type } from '@/constants/tokens';

type Icon = Parameters<typeof IconSymbol>[0]['name'];

/** A page of its own, a phone column wide, with Back over it (as How scores work). */
export function ScorePage({ eyebrow, title, children }: { eyebrow?: string | null; title: string; children: ReactNode }) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + layout.minTapTarget + space.lg, paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: gutter }}>
        <View style={styles.page}>
          <View>
            {eyebrow ? (
              <Caption tone="muted" style={styles.caps}>
                {eyebrow}
              </Caption>
            ) : null}
            <Title>{title}</Title>
          </View>
          {children}
        </View>
      </ScrollView>
      <View style={[styles.top, { top: insets.top + space.sm, left: gutter }]}>
        <GlassButton accessibilityLabel="Back" icon="chevron.left" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </View>
    </View>
  );
}

/** The score as the page's one big figure, what it's from under it (Red-score). */
export function BigScore({ score, sub }: { score: string; sub: string }) {
  return (
    <View style={styles.big} accessible accessibilityLabel={`Score ${score}. ${sub}`}>
      <Display>{score}</Display>
      <Body tone="muted" style={styles.center}>
        {sub}
      </Body>
    </View>
  );
}

/** Two or three figures side by side, each in its card: "This Negroni · 12 of 20 · to its own score". One with `onPress` is a link. */
export function Stats({ items }: { items: { title: string; value: string; sub?: string | null; onPress?: () => void }[] }) {
  const ds = useDs();
  return (
    <View style={styles.stats}>
      {items.map((s) => {
        const label = [s.title, s.value, s.sub].filter(Boolean).join('. ');
        const style = [styles.stat, { backgroundColor: ds.c.surface, borderColor: ds.c.line }];
        const body = (
          <>
            <Caption tone="muted" numberOfLines={2}>
              {s.title}
            </Caption>
            <DsText variant="title" style={displayName.card}>
              {s.value}
            </DsText>
            {s.sub ? <Caption tone="muted">{s.sub}</Caption> : null}
          </>
        );
        return s.onPress ? (
          <PressableScale key={s.title} role="link" accessibilityLabel={label} onPress={s.onPress} style={style}>
            {body}
          </PressableScale>
        ) : (
          <View key={s.title} accessible accessibilityLabel={label} style={style}>
            {body}
          </View>
        );
      })}
    </View>
  );
}

/** A quiet line on the fill, with its icon: "Not enough rankers yet in New York." */
export function Note({ icon, children }: { icon?: Icon; children: string }) {
  const ds = useDs();
  return (
    <View style={[styles.note, { backgroundColor: ds.c.raised }]}>
      {icon ? <IconSymbol name={icon} size={20} color={ds.c.ink} /> : null}
      <Body style={styles.flex}>{children}</Body>
    </View>
  );
}

/** Totals as bars, longest first: "Order again 18". Complaints in amber. */
export function Meter({ rows }: { rows: { label: string; n: number; warn?: boolean }[] }) {
  const ds = useDs();
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <View style={styles.meter}>
      {rows.map((r) => (
        <View key={r.label} style={styles.meterRow} accessible accessibilityLabel={`${r.label}: ${r.n}`}>
          <Body numberOfLines={1} style={styles.meterLabel}>
            {r.label}
          </Body>
          <View style={[styles.track, { backgroundColor: ds.c.raised }]}>
            <View style={[styles.fill, { width: `${Math.round((r.n / max) * 100)}%`, backgroundColor: r.warn ? STATUS.warning : ds.accentFill.fill }]} />
          </View>
          <Caption tone="muted" style={styles.meterN}>
            {String(r.n)}
          </Caption>
        </View>
      ))}
    </View>
  );
}

/**
 * The score over time (Red-score "spark"): a line through the points, the
 * points before `splitAt` in pencil (the old spec) and the rest in the
 * accent, with dashed marks and their words under them.
 */
export function Sparkline({ points, marks, splitAt, label }: { points: number[]; marks: { index: number; label: string }[]; splitAt?: number | null; label: string }) {
  const ds = useDs();
  const [w, setW] = useState(0);
  const h = 130;
  const lo = Math.min(...points) - 0.3;
  const hi = Math.max(...points) + 0.3;
  const n = Math.max(1, points.length - 1);
  const X = (i: number) => 8 + ((w - 16) * i) / n;
  const Y = (v: number) => 14 + (h - 44) * (1 - (v - lo) / (hi - lo));
  const line = (from: number, to: number) => 'M' + points.slice(from, to + 1).map((v, i) => `${X(from + i).toFixed(1)} ${Y(v).toFixed(1)}`).join('L');
  const split = splitAt && splitAt > 0 ? splitAt : null;
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: h }} accessible role="img" accessibilityLabel={label}>
      {w > 0 && points.length > 1 ? (
        <Svg width={w} height={h}>
          {marks.map((m) => (
            <Path key={`m${m.index}`} d={`M${X(m.index).toFixed(1)} 6V${h - 26}`} stroke={ds.c.lineStrong} strokeWidth={1} strokeDasharray="3 4" />
          ))}
          {split ? <Path d={line(0, split - 1)} stroke={ds.c.sketchInk} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
          {split ? <Path d={line(split - 1, split)} stroke={ds.c.faint} strokeWidth={2} fill="none" strokeDasharray="2 4" strokeLinecap="round" /> : null}
          <Path d={line(split ?? 0, points.length - 1)} stroke={ds.accentText} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          {marks.map((m) => (
            <SvgText key={`t${m.index}`} x={X(m.index) + 5} y={h - 10} fill={ds.c.muted} fontSize={type.caption.fontSize}>
              {m.label}
            </SvgText>
          ))}
        </Svg>
      ) : null}
    </View>
  );
}

/** "8.9 for its drinks", a bar's score in its row (Kept-score): the chart, the score in the display face, a line under it. */
export function ScoreLine({ title, sub, onPress }: { title: string; sub?: string | null; onPress?: () => void }) {
  const ds = useDs();
  const body = (
    <>
      <View style={[styles.scoreIcon, { backgroundColor: ds.c.raised }]}>
        <IconSymbol name="chart.bar" size={20} color={ds.c.ink} />
      </View>
      <View style={styles.flex}>
        <DsText variant="title" style={displayName.card}>
          {title}
        </DsText>
        {sub ? <Caption tone="muted">{sub}</Caption> : null}
      </View>
      {onPress ? <IconSymbol name="chevron.right" size={14} color={ds.c.faint} /> : null}
    </>
  );
  return onPress ? (
    <PressableScale role="link" accessibilityLabel={[title, sub].filter(Boolean).join('. ')} onPress={onPress} style={styles.scoreLine}>
      {body}
    </PressableScale>
  ) : (
    <View accessible accessibilityLabel={[title, sub].filter(Boolean).join('. ')} style={styles.scoreLine}>
      {body}
    </View>
  );
}

/** One person's rank of this drink: "You · Tonight · 9.0" (Loop-ladder "You and friends"). */
export function PersonRow({ name, avatarUrl, sub, score }: { name: string; avatarUrl?: string | null; sub: string; score: string }) {
  return (
    <View style={styles.person} accessible accessibilityLabel={`${name}, ${sub}: ${score}`}>
      <UserAvatar uri={avatarUrl} name={name} size={40} />
      <View style={styles.flex}>
        <Body numberOfLines={1}>{name}</Body>
        <Caption tone="muted">{sub}</Caption>
      </View>
      <DsText variant="title" style={displayName.row}>
        {score}
      </DsText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { width: '100%', maxWidth: 600, alignSelf: 'center', gap: space.lg },
  top: { position: 'absolute' },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2 },
  big: { alignItems: 'center', gap: space.sm, paddingBottom: space.sm },
  center: { textAlign: 'center', maxWidth: 320 },
  stats: { flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, minWidth: 0, gap: space.xs, padding: space.md, borderRadius: radius.control + space.xs, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth },
  note: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg, borderRadius: radius.control + space.sm, borderCurve: 'continuous' },
  flex: { flex: 1, minWidth: 0 },
  meter: { gap: space.md },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: space.md - 2 },
  meterLabel: { width: 112 },
  track: { flex: 1, height: 10, borderRadius: radius.mark, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.mark },
  meterN: { width: 34, textAlign: 'right' },
  scoreLine: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  scoreIcon: { width: layout.minTapTarget - 4, height: layout.minTapTarget - 4, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  person: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
});
