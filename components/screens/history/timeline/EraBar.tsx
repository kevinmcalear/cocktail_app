import * as Haptics from 'expo-haptics';
import { useRef } from 'react';
import { Platform, StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';

import { Caption, GlassSurface, useDs } from '@/components/ds';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { DECADES, ERAS, FIRST_DECADE, eraOf } from '@/lib/timeline';

const HIST_H = 32;

/**
 * The phone timeline's way through time: a glass bar at the bottom with a
 * histogram of drinks per decade and a needle at the year on screen. Tap or
 * drag along it to travel (a tick of haptics per decade); screen readers
 * swipe up and down to move an era at a time.
 */
export function EraBar({ counts, year, onTravel, bottom }: { counts: number[]; year: number | null; onTravel: (year: number) => void; bottom: number }) {
  const ds = useDs();
  const width = useRef(1);
  const lastDecade = useRef<number | null>(null);
  const max = Math.max(1, ...counts);
  const era = year != null ? eraOf(year) : null;
  const eraIndex = era ? ERAS.findIndex((e) => e.key === era.key) : -1;
  const span = DECADES * 10;
  const needle = year != null ? Math.min(1, Math.max(0, (year - FIRST_DECADE) / span)) : null;

  const travel = (e: GestureResponderEvent) => {
    const f = Math.min(0.9999, Math.max(0, e.nativeEvent.locationX / width.current));
    const decade = Math.floor(f * DECADES);
    if (decade === lastDecade.current) return;
    lastDecade.current = decade;
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    onTravel(FIRST_DECADE + decade * 10);
  };
  const stepEra = (by: number) => {
    const next = ERAS[Math.min(ERAS.length - 1, Math.max(0, (eraIndex < 0 ? 0 : eraIndex) + by))];
    onTravel(next.start);
  };

  return (
    <View style={[styles.wrap, { bottom }]} pointerEvents="box-none">
      <GlassSurface style={styles.glass}>
        <View style={styles.head}>
          <Caption color={ds.accentText} style={styles.year}>
            {year ?? ''}
          </Caption>
          <Caption numberOfLines={1} style={styles.flex}>
            {era?.name ?? ''}
          </Caption>
          <Caption tone="muted">Drag to travel</Caption>
        </View>
        <View
          role="slider"
          accessibilityLabel="Year"
          aria-valuemin={FIRST_DECADE}
          aria-valuemax={FIRST_DECADE + span}
          aria-valuenow={year ?? FIRST_DECADE}
          aria-valuetext={year != null ? `${year}, ${era?.name}` : undefined}
          accessibilityActions={[{ name: 'increment', label: 'Next era' }, { name: 'decrement', label: 'Previous era' }]}
          onAccessibilityAction={(e) => stepEra(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
          onLayout={(e: LayoutChangeEvent) => (width.current = Math.max(1, e.nativeEvent.layout.width))}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
          onResponderGrant={(e) => {
            lastDecade.current = null;
            travel(e);
          }}
          onResponderMove={travel}
          style={styles.track}
        >
          <View style={styles.bars} pointerEvents="none">
            {counts.map((c, i) => {
              const decadeEra = eraOf(FIRST_DECADE + i * 10);
              return (
                <View
                  key={i}
                  style={[
                    styles.bar,
                    { height: Math.max(3, Math.round((c / max) * HIST_H)), backgroundColor: decadeEra.key === era?.key ? ds.c.ink : ds.c.lineStrong },
                  ]}
                />
              );
            })}
          </View>
          {needle != null ? <View pointerEvents="none" style={[styles.needle, { left: `${needle * 100}%`, backgroundColor: ds.accentText }]} /> : null}
        </View>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.md, right: space.md },
  glass: { borderRadius: radius.card + space.sm, paddingHorizontal: space.lg, paddingTop: space.sm + 2 },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm + 2 },
  year: { fontFamily: fontFamilies.mono, fontVariant: ['tabular-nums'] },
  flex: { flex: 1, minWidth: 0 },
  track: { height: layout.minTapTarget, justifyContent: 'flex-end' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: HIST_H, marginBottom: space.xs + 2 },
  bar: { flex: 1 },
  needle: { position: 'absolute', bottom: space.xs, width: 3, height: layout.minTapTarget - space.xs, marginLeft: -1.5, borderRadius: radius.pill },
});
