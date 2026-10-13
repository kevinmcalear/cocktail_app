import { LinearGradient } from 'expo-linear-gradient';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { GlassSurface, PressableScale, useDs } from '@/components/ds';
import { ScreenHeader } from '@/components/nav/ScreenHeader';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, space, springs } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';

import { SearchPill } from './DiscoverControls';

interface DiscoverHeaderProps {
  query: string;
  /** On the map, the pill searches what it shows. */
  onMap: boolean;
  onSearch: () => void;
  onClear: () => void;
  /** How many filters are on; the options button fills in when any are. */
  filters: number;
  onOptions: () => void;
}

/**
 * Discover's phone header: the logo, the search pill filling the middle, the
 * options button (list or map, where, filters) and you, on one row (Eddie,
 * 13 Oct). The pill is the page's identity, so "Discover" is a heading only
 * screen readers hear.
 */
export function DiscoverHeader({ query, onMap, onSearch, onClear, filters, onOptions }: DiscoverHeaderProps) {
  const ds = useDs();
  const on = filters > 0;
  const ink = on ? ds.c.ground : ds.c.ink;
  const pill = (
    <View style={styles.middle}>
      <View style={styles.flex}>
        <SearchPill compact query={query} placeholder={onMap ? 'Search this area' : 'Bars and drinks'} label={onMap ? 'Search this area' : 'Search bars and drinks'} onOpen={onSearch} onClear={onClear} />
      </View>
      <PressableScale accessibilityLabel={on ? `Options: list or map, where, and filters, ${filters} on` : 'Options: list or map, where, and filters'} onPress={onOptions} hitSlop={4}>
        <GlassSurface interactive tint={on ? ds.c.ink : undefined} style={styles.options}>
          <IconSymbol name="line.3.horizontal.decrease" size={18} color={ink} />
        </GlassSurface>
      </PressableScale>
    </View>
  );
  return <ScreenHeader title="Discover" center={pill} create={false} />;
}

/** Scrolled this far past the top before the header may go, and the travel either way that hides or brings it back. */
const TOP = 24;
const DOWN = 16;
const UP = 8;

/**
 * One scroll event: `travel` is how far the list has moved in the current
 * direction, `away` 1 when the header is gone. Near the top it always shows.
 */
export function scrollAwayStep(y: number, dy: number, travel: number, away: number) {
  'worklet';
  const t = travel * dy > 0 ? travel + dy : dy;
  return { travel: t, away: y <= TOP ? 0 : t > DOWN ? 1 : t < -UP ? 0 : away };
}

/**
 * The phone list's header goes as you scroll down and comes back after a
 * small scroll up (Kevin, 13 Oct). Reanimated reads the scroll on the UI
 * thread; the screen only hears when it flips. Reduce Motion fades it instead
 * of sliding it.
 */
export function useScrollAway() {
  const reduce = useReducedMotion();
  const [hidden, setHidden] = useState(false);
  const away = useSharedValue(0);
  const last = useSharedValue(0);
  const travel = useSharedValue(0);
  const height = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    const y = e.contentOffset.y;
    const dy = y - last.get();
    last.set(y);
    // The bounce past the end scrolls back up on its own: not a scroll up.
    if (y + e.layoutMeasurement.height > e.contentSize.height) return;
    const step = scrollAwayStep(y, dy, travel.get(), away.get());
    travel.set(step.travel);
    const next = step.away;
    if (next === away.get()) return;
    away.set(next);
    scheduleOnRN(setHidden, next === 1);
  });
  const style = useAnimatedStyle(() => {
    const gone = away.get() === 1;
    return {
      opacity: withTiming(gone ? 0 : 1, { duration: 180 }),
      transform: [{ translateY: reduce ? 0 : withSpring(gone ? -height.get() : 0, springs.snap) }],
    };
  });
  const onLayout = (e: LayoutChangeEvent) => height.set(e.nativeEvent.layout.height);
  return { hidden, onScroll, style, onLayout };
}

/**
 * The header over the phone list, on the ground with a short fade below it,
 * and a strip that keeps the status bar readable once the header has gone.
 */
export function ScrollAwayHeader({ away, onHeight, children }: { away: ReturnType<typeof useScrollAway>; onHeight: (height: number) => void; children: ReactNode }) {
  const ds = useDs();
  const top = useSafeAreaInsets().top;
  return (
    <>
      <Animated.View
        pointerEvents={away.hidden ? 'none' : 'box-none'}
        aria-hidden={away.hidden}
        style={[styles.header, { backgroundColor: ds.c.ground }, away.style]}
        onLayout={(e) => (away.onLayout(e), onHeight(e.nativeEvent.layout.height))}
      >
        {children}
        <LinearGradient pointerEvents="none" colors={[ds.c.ground, withAlpha(ds.c.ground, 0)]} style={styles.fade} />
      </Animated.View>
      {top ? <LinearGradient pointerEvents="none" colors={[ds.c.ground, withAlpha(ds.c.ground, 0)]} locations={[0.7, 1]} style={[styles.status, { height: top + space.lg }]} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  middle: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  options: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  header: { position: 'absolute', top: 0, left: 0, right: 0, paddingBottom: space.sm },
  fade: { position: 'absolute', left: 0, right: 0, bottom: -space.lg, height: space.lg },
  status: { position: 'absolute', top: 0, left: 0, right: 0 },
});
