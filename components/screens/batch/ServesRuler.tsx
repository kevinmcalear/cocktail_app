import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View, type AccessibilityActionEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Caption, useDs } from '@/components/ds';
import { radius, space, springs } from '@/constants/tokens';
import { servesStops, stepStops, stopPosition } from '@/lib/batch';
import { withAlpha } from '@/lib/color';

/** Pixels per tick. */
const TICK = 14;
const HEIGHT = 64;

interface ServesRulerProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

/**
 * The serve count as a ruler under a fixed needle. A tick is one serve up to
 * 60, then 5, 25 and 100 (lib/batch servesStops), so the cap is reachable
 * by dragging and only ~180 ticks are ever drawn. Drag it (touch or mouse)
 * and every tick that passes the needle is one selection tick on native; let
 * go and it springs onto the nearest tick. A typed count between ticks sits
 * between them. On web it's also a focusable slider: arrow keys step one
 * tick, Page Up/Down five, Home/End to the ends.
 */
export function ServesRuler({ value, min, max, onChange }: ServesRulerProps) {
  const ds = useDs();
  const [width, setWidth] = useState(0);
  const stops = servesStops(min, max);
  const span = (stops.length - 1) * TICK;
  // How far the ruler has moved: 0 puts `min` under the needle.
  const offset = useSharedValue(stopPosition(stops, value) * TICK);
  const start = useSharedValue(0);
  const startX = useSharedValue(0);
  // The tick under the needle, as an index into `stops`; `home` is where `value` sits (fractional for a typed count).
  const last = useSharedValue(0);
  const home = useSharedValue(stopPosition(stops, value));
  const moved = useSharedValue(false);
  const dragging = useSharedValue(false);

  const commit = (next: number) => {
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    onChange(next);
  };

  // Changes from the keyboard or the number field spring the ruler across.
  useEffect(() => {
    if (dragging.get()) return;
    const at = stopPosition(stops, value);
    home.set(at);
    offset.set(withSpring(at * TICK, springs.snap));
  }, [value, stops, dragging, home, offset]);

  const pan = Gesture.Pan()
    .activeOffsetX([-4, 4])
    .failOffsetY([-14, 14])
    .onBegin((e) => {
      dragging.set(true);
      moved.set(false);
      last.set(Math.round(home.get()));
      start.set(offset.get());
      startX.set(e.absoluteX);
    })
    .onUpdate((e) => {
      // From the press, not from activation: on web, translationX starts
      // where the pan activates, which loses the first few pixels of a drag.
      const raw = Math.min(span, Math.max(0, start.get() - (e.absoluteX - startX.get())));
      offset.set(raw);
      const next = Math.round(raw / TICK);
      // One commit per tick passed, even when a fast drag skips some in a frame.
      while (last.get() !== next) {
        last.set(last.get() + (next > last.get() ? 1 : -1));
        moved.set(true);
        scheduleOnRN(commit, stops[last.get()]);
      }
    })
    .onFinalize(() => {
      dragging.set(false);
      // A nudge that passed no tick leaves a typed count where it was.
      offset.set(withSpring((moved.get() ? last.get() : home.get()) * TICK, springs.snap));
    });

  const strip = useAnimatedStyle(() => ({ transform: [{ translateX: width / 2 - offset.get() }] }));

  const step = (by: number) => {
    const next = stepStops(stops, value, by);
    if (next !== value) onChange(next);
  };
  const onKeyDown = (e: { key: string; preventDefault: () => void }) => {
    const by: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 5, PageDown: -5, Home: -stops.length, End: stops.length };
    if (by[e.key] === undefined) return;
    e.preventDefault();
    step(by[e.key]);
  };
  const onAccessibilityAction = (e: AccessibilityActionEvent) => step(e.nativeEvent.actionName === 'increment' ? 1 : -1);

  // Major every five ticks' worth of serves, a number every ten: 5s and 10s at
  // first, then 25 and 50, 125 and 250, 500 and 1000. Numbers stay 5 ticks apart.
  const ticks = [];
  let labelled = -Infinity;
  for (let i = 0; i < stops.length; i++) {
    const n = stops[i];
    const each = i > 0 ? n - stops[i - 1] : 1;
    const major = n % (5 * each) === 0 || n === max;
    const label = (n % (10 * each) === 0 && i - labelled >= 5) || n === min || n === max;
    if (label) labelled = i;
    ticks.push(
      <View key={n} style={[styles.tickSlot, { left: i * TICK - TICK / 2 }]}>
        <View style={[styles.tick, { height: major ? 22 : 12, backgroundColor: major ? ds.c.muted : ds.c.faint }]} />
        {label ? <Caption tone="muted" style={styles.tickLabel}>{n}</Caption> : null}
      </View>
    );
  }
  const clear = withAlpha(ds.c.surface, 0);

  return (
    <GestureDetector gesture={pan}>
      <View
        role="slider"
        accessibilityLabel="Number of serves"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${value} ${value === 1 ? 'serve' : 'serves'}`}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onAccessibilityAction}
        tabIndex={0}
        // @ts-expect-error onKeyDown is web-only (react-native-web)
        onKeyDown={onKeyDown}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={[styles.ruler, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}
      >
        <Animated.View style={[styles.strip, strip]} aria-hidden>
          {ticks}
        </Animated.View>
        <LinearGradient pointerEvents="none" colors={[ds.c.surface, clear]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.fade, styles.fadeLeft]} />
        <LinearGradient pointerEvents="none" colors={[clear, ds.c.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.fade, styles.fadeRight]} />
        <View pointerEvents="none" style={[styles.needle, { backgroundColor: ds.accentText }]} />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  ruler: {
    height: HEIGHT,
    borderRadius: radius.control,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    cursor: 'pointer',
  },
  strip: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  tickSlot: { position: 'absolute', top: space.sm, width: TICK, alignItems: 'center' },
  tick: { width: 1.5 },
  tickLabel: { position: 'absolute', top: 26, left: (TICK - 40) / 2, width: 40, textAlign: 'center' },
  fade: { position: 'absolute', top: 0, bottom: 0, width: '22%' },
  fadeLeft: { left: 0 },
  fadeRight: { right: 0 },
  needle: { position: 'absolute', left: '50%', top: space.xs, bottom: space.xs, width: 3, marginLeft: -1.5, borderRadius: radius.pill },
});
