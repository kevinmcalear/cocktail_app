import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedRef, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { Caption, PressableScale, useDs } from '@/components/ds';
import { familyHues, fontFamilies, radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import { AXIS_TICKS, axisEras, axisX, TIER_LABEL, type AxisFamily, type AxisRow } from '@/lib/timeTree';

/** Taller than the board's 26 so each row is a fair tap. */
const ROW = 34;
const HEAD = 60;
const GAP = 14;
const AXIS = 52;
/** The board's chart width; phones swipe across it. */
const MIN_W = 820;
const MARK = 10;

export type Jump = { key: string; n: number } | null;

/** The mark's top-left in the chart, for lines and scrolling. */
function layoutOf(families: AxisFamily[]) {
  let y = AXIS;
  const heads: { key: string; y: number }[] = [];
  const tops = new Map<string, number>();
  for (const f of families) {
    heads.push({ key: f.key, y });
    y += HEAD;
    f.rows.forEach((r, i) => tops.set(r.node.key, y + i * ROW));
    y += f.rows.length * ROW + GAP;
  }
  return { heads, tops, height: y + space.lg };
}

/**
 * Every family on one time axis (prep-hist-tree-*): era bands and year ticks
 * behind, a mark per drink at its year in the family's colour, elbow lines
 * from parent to riff. Wider than a phone: it opens on the recent years and
 * swipes sideways for earlier ones; the family names stay pinned at the left.
 */
export function TimeTree({
  families,
  header,
  selectedKey,
  onSelect,
  jump,
  bottomPad,
}: {
  families: AxisFamily[];
  header: ReactNode;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  /** A drink key, or "f:<family>", to bring into view. */
  jump: Jump;
  bottomPad: number;
}) {
  const ds = useDs();
  const hues = familyHues[ds.scheme];
  const hueOf = (family: string) => hues[family as keyof typeof hues] ?? hues.trunk;
  const vertical = useRef<ComponentRef<typeof ScrollView>>(null);
  const across = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });
  const pinned = useAnimatedStyle(() => ({ transform: [{ translateX: scrollX.value }] }));
  const [viewW, setViewW] = useState(0);
  const chartY = useRef(0);
  const W = Math.max(MIN_W, viewW);
  const { heads, tops, height } = layoutOf(families);

  // Open on the recent years: the right-hand end.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || !viewW || W <= viewW) return;
    opened.current = true;
    across.current?.scrollTo({ x: W - viewW, animated: false });
  });

  useEffect(() => {
    if (!jump) return;
    const t = setTimeout(() => {
      const head = jump.key.startsWith('f:') ? heads.find((h) => h.key === jump.key.slice(2)) : null;
      const top = head ? head.y : tops.get(jump.key);
      if (top == null) return;
      vertical.current?.scrollTo({ y: Math.max(0, chartY.current + top - (head ? space.sm : 160)), animated: true });
      const row = head ? null : families.flatMap((f) => f.rows).find((r) => r.node.key === jump.key);
      if (row && viewW && W > viewW) across.current?.scrollTo({ x: Math.min(W - viewW, Math.max(0, row.x * W - viewW / 2)), animated: true });
    }, 80);
    return () => clearTimeout(t);
    // Only a new jump scrolls; layout changes alone don't.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jump?.n]);

  const line = (r: AxisRow, family: AxisFamily) => {
    if (r.parentRow == null) return null;
    const parent = family.rows[r.parentRow];
    const pTop = tops.get(parent.node.key)!;
    const cTop = tops.get(r.node.key)!;
    const px = parent.x * W;
    const cx = r.x * W;
    const border = { borderColor: withAlpha(hueOf(family.key), 0.5) };
    const top = pTop + ROW / 2 + MARK / 2 + 2;
    const h = cTop + ROW / 2 - top;
    if (Math.abs(cx - px) < 3) return <View key={`l${r.node.key}`} style={[styles.line, border, { left: px, top, height: h - MARK / 2 - 2, borderLeftWidth: 1.4 }]} />;
    return cx > px ? (
      <View key={`l${r.node.key}`} style={[styles.line, border, { left: px, top, width: cx - px - MARK / 2 - 2, height: h, borderLeftWidth: 1.4, borderBottomWidth: 1.4 }]} />
    ) : (
      <View key={`l${r.node.key}`} style={[styles.line, border, { left: cx + MARK / 2 + 2, top, width: px - cx - MARK / 2 - 2, height: h, borderRightWidth: 1.4, borderBottomWidth: 1.4 }]} />
    );
  };

  const row = (r: AxisRow, family: AxisFamily) => {
    const n = r.node;
    const hue = hueOf(family.key);
    const cx = r.x * W;
    const selected = n.key === selectedKey;
    const right = r.x > 0.68;
    const meta = [r.undated ? 'no year' : `${n.approx ? 'c.' : ''}${n.year}`, n.creator].filter(Boolean).join(' · ');
    const mark = r.tier === 'style' ? { backgroundColor: hue, borderRadius: radius.mark } : r.tier === 'modern' ? { backgroundColor: ds.c.ground, borderColor: hue, borderWidth: 2 } : { backgroundColor: hue };
    return (
      <PressableScale
        key={n.key}
        role="button"
        accessibilityLabel={[n.name, TIER_LABEL[r.tier], meta, r.from ? `from ${r.from.name}` : null, selected ? 'selected' : null].filter(Boolean).join(', ')}
        aria-selected={selected}
        onPress={() => onSelect(n.key)}
        style={[styles.row, { top: tops.get(n.key), width: W }, selected ? { backgroundColor: ds.c.raised } : null]}
      >
        {selected ? <View style={[styles.ring, { left: cx - MARK / 2 - 4, borderColor: ds.accentText }]} /> : null}
        <View style={[styles.mark, { left: cx - MARK / 2 }, r.tier !== 'style' ? styles.round : null, mark]} />
        {/* The label sits on the ground, so a riff's line never runs through its text. */}
        <View style={[styles.label, { backgroundColor: selected ? ds.c.raised : ds.c.ground }, right ? { right: W - cx + space.sm, flexDirection: 'row-reverse' } : { left: cx + space.sm }]}>
          <Caption
            numberOfLines={1}
            color={selected ? ds.accentText : undefined}
            style={r.tier === 'style' ? styles.styleName : selected ? styles.picked : styles.name}
          >
            {n.name}
          </Caption>
          {meta ? <Caption tone="muted" numberOfLines={1} style={styles.meta}>{meta}</Caption> : null}
          {r.from ? <Caption tone="muted" numberOfLines={1} style={styles.from}>{`from ${r.from.name}`}</Caption> : null}
        </View>
      </PressableScale>
    );
  };

  return (
    <ScrollView ref={vertical} contentContainerStyle={{ paddingBottom: bottomPad }} keyboardShouldPersistTaps="handled">
      {header}
      <View onLayout={(e) => (chartY.current = e.nativeEvent.layout.y)}>
        <Animated.ScrollView
          ref={across}
          horizontal
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsHorizontalScrollIndicator={false}
          onLayout={(e) => setViewW(Math.round(e.nativeEvent.layout.width))}
        >
          <View role="list" aria-label="Every classic on a time axis, by family" style={{ width: W, height }}>
            {axisEras().map((e, i) => (
              <View key={e.key} style={[styles.band, { left: e.x * W, width: e.w * W }]}>
                {i % 2 === 0 ? <View style={[StyleSheet.absoluteFill, styles.fill, { backgroundColor: ds.c.line }]} /> : null}
                <Caption tone="muted" numberOfLines={1} style={[styles.mono, { marginTop: i % 2 ? space.lg : 0 }]}>
                  {e.name}
                </Caption>
              </View>
            ))}
            {AXIS_TICKS.map((t) => (
              <View key={t} style={[styles.tick, { left: axisX(t) * W, backgroundColor: ds.c.line }]}>
                <Caption tone="muted" style={[styles.mono, styles.tickLabel, { backgroundColor: ds.c.ground }]}>
                  {String(t)}
                </Caption>
              </View>
            ))}
            {families.flatMap((f) => f.rows.map((r) => line(r, f)))}
            {families.flatMap((f) => f.rows.map((r) => row(r, f)))}
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, pinned]}>
              {families.map((f) => (
                <View key={f.key} role="heading" aria-level={2} style={[styles.head, { top: heads.find((h) => h.key === f.key)!.y + space.md }]}>
                  <Caption style={[styles.picked, { color: hueOf(f.key) }]}>{f.name}</Caption>
                  <Caption tone="muted">{`${f.blurb.replace(/\.$/, '')} · ${f.drinks} drink${f.drinks === 1 ? '' : 's'}`}</Caption>
                </View>
              ))}
            </Animated.View>
          </View>
        </Animated.ScrollView>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  band: { position: 'absolute', top: 0, bottom: 0, paddingLeft: space.xs },
  mono: { fontFamily: fontFamilies.mono },
  // The board's faint alternate band: a third of a hairline's strength.
  fill: { opacity: 0.35 },
  from: { fontStyle: 'italic' },
  tick: { position: 'absolute', top: AXIS - 16, bottom: 0, width: StyleSheet.hairlineWidth },
  tickLabel: { position: 'absolute', top: -2, width: 44, marginLeft: -22, textAlign: 'center' },
  line: { position: 'absolute' },
  row: { position: 'absolute', left: 0, height: ROW, borderRadius: radius.mark, justifyContent: 'center' },
  mark: { position: 'absolute', width: MARK, height: MARK, top: (ROW - MARK) / 2 },
  round: { borderRadius: radius.pill },
  ring: { position: 'absolute', width: MARK + 8, height: MARK + 8, top: (ROW - MARK) / 2 - 4, borderRadius: radius.pill, borderWidth: 2 },
  label: { position: 'absolute', top: space.xs, height: ROW - space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.xs },
  name: { fontFamily: fontFamilies.bodyMedium },
  picked: { fontFamily: fontFamilies.bodySemiBold },
  styleName: { fontFamily: fontFamilies.mono, letterSpacing: 1.2, textTransform: 'uppercase' },
  meta: { fontFamily: fontFamilies.mono },
  head: { position: 'absolute', left: space.xs, gap: 2 },
});
