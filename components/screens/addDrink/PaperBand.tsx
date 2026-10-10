import { useEffect, useState, type ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { Caption, PressableScale, Tag, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { backbar, fontFamilies, layout, radius, space, springs } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';

export interface PaperBandProps {
  /** Where it's at: "2 of 9", or a word ("Review") with the bar full. */
  progress: { now: number; of: number; label: string };
  /** On the first step back closes (the draft is kept). */
  first: boolean;
  onBack: () => void;
  /** Space above the controls (the status bar on a phone). */
  top: number;
  side: number;
  /** In a centred column (wide screens): rounded, not edge to edge. */
  rounded: boolean;
  /** Just the controls, while the keyboard is up on a phone. */
  folded?: boolean;
  /** The drawing's side; by default 200 in a column and 152 in a phone's band. */
  size?: number;
  /** The drawing, and a key that changes when it does: a new one fades in over the old with a small bounce. */
  art: ReactNode;
  artKey: string;
  /** What the drawing is: "Sketch of the drink so far". */
  artLabel: string;
  /**
   * Under the drawing: what's being added, if it needs saying ("House prep"),
   * and a note ("Updates as you go"). Never "Sketch": a drawing is obviously a drawing.
   */
  tag?: string;
  note?: string;
}

/**
 * The paper band at the top of every add wizard: back, progress, and a
 * drawing of the thing being added that redraws as it's filled in.
 */
export function PaperBand({ progress, first, onBack, top, side, rounded, folded, size: sizeProp, art, artKey, artLabel, tag, note = 'Updates as you go' }: PaperBandProps) {
  const ds = useDs();
  const ink = ds.c.sketchInk;
  const reduceMotion = useReducedMotion();
  // The drawing before this one, faded out under the new one. Plain opacity, not
  // Reanimated's exiting animations: an exiting view removed again mid-fade (each
  // keystroke redraws, the keyboard folds the band) corrupted its view bookkeeping
  // and crashed iOS release builds.
  const [shown, setShown] = useState<{ key: string; now: ReactNode; before: ReactNode; n: number }>({ key: artKey, now: art, before: null, n: 0 });
  if (shown.key !== artKey) setShown({ key: artKey, now: art, before: shown.now, n: shown.n + 1 });

  const scale = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) return;
    scale.set(withSequence(withSpring(0.96, springs.snap), withSpring(1, springs.pour)));
  }, [artKey, reduceMotion, scale]);
  const bounce = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const size = sizeProp ?? (rounded ? 200 : 152);

  return (
    <View style={[styles.band, { backgroundColor: ds.c.paper, paddingTop: top, paddingHorizontal: side }, rounded && styles.rounded]}>
      {/* Android draws the band under the status bar: dark icons, so they read on paper in both themes. */}
      {Platform.OS === 'android' && !rounded ? <StatusBar style="dark" /> : null}
      <View style={styles.controls}>
        <PressableScale onPress={onBack} accessibilityLabel={first ? 'Close. Your draft is kept' : 'Back'} style={[styles.back, { backgroundColor: backbar.light.glass }]}>
          <IconSymbol name={first ? 'xmark' : 'chevron.left'} size={18} color={ink} />
        </PressableScale>
        <View
          style={[styles.track, { backgroundColor: withAlpha(ink, 0.15) }]}
          role="progressbar"
          accessibilityLabel="Progress"
          aria-valuemin={0}
          aria-valuemax={progress.of}
          aria-valuenow={progress.now}
        >
          <View style={[styles.fill, { backgroundColor: ink, width: `${(progress.now / progress.of) * 100}%` }]} />
        </View>
        <Caption color={ink} style={styles.mono}>
          {progress.label}
        </Caption>
      </View>
      {folded ? null : (
        <>
          <Animated.View style={[styles.drawing, { width: size, height: size }, bounce]} aria-label={artLabel}>
            {shown.before ? (
              <Layer key={`out-${shown.n - 1}`} from={1} to={0}>
                {shown.before}
              </Layer>
            ) : null}
            <Layer key={`in-${shown.n}`} from={0} to={1}>
              {art}
            </Layer>
          </Animated.View>
          <View style={styles.foot}>
            {tag ? <Tag label={tag} tone="paper" /> : null}
            <Caption color={ink} style={styles.mono}>
              {note}
            </Caption>
          </View>
        </>
      )}
    </View>
  );
}

/** One drawing, fading from `from` to `to` opacity once, when it mounts. */
function Layer({ from, to, children }: { from: number; to: number; children: ReactNode }) {
  const opacity = useSharedValue(from);
  useEffect(() => {
    opacity.set(withTiming(to, { duration: 260 }));
  }, [opacity, to]);
  const fade = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return <Animated.View style={[StyleSheet.absoluteFill, fade]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  band: { paddingBottom: space.md, alignItems: 'center' },
  rounded: { borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' },
  controls: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: space.md },
  back: { width: layout.minTapTarget, height: layout.minTapTarget, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  track: { flex: 1, height: 4, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: 4, borderRadius: radius.pill },
  mono: { fontFamily: fontFamilies.monoMedium },
  drawing: { marginTop: space.sm },
  foot: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
