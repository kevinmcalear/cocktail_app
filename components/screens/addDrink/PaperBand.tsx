import { useEffect, useState, type ReactNode } from 'react';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { Caption, PressableScale, Tag, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ViewAsPill } from '@/components/ViewAsBanner';
import { backbar, fontFamilies, layout, radius, space, springs } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';

import { Trail, type TrailItem } from './Trail';

/** The compact band's drawing, in a tile a little taller than it (canvas Create, Q17 D: 136 in all). */
const THUMB = 60;

export interface PaperBandProps {
  /** Where it's at: "2 of 9", or a word ("Review") with the bar full. */
  progress: { now: number; of: number; label: string };
  /** On the first step back closes (the draft is kept). */
  first: boolean;
  /** On the first step, back goes to this instead of closing: a chevron with its name ("Ash Garden"). */
  backTo?: string;
  /** Where you are, from the menu down (make-anything-overview, rule 3), under the progress. */
  trail?: readonly TrailItem[];
  onBack: () => void;
  /** Space above the controls (the status bar on a phone). */
  top: number;
  side: number;
  /** In a centred column (wide screens): rounded, not edge to edge. */
  rounded: boolean;
  /** Just the controls, while the keyboard is up on a phone. */
  folded?: boolean;
  /**
   * One row on the steps where you type (canvas Create, Q17 D): back, the
   * drawing as a thumbnail that `onShowArt` opens full size, the progress, and
   * the action. It stays the same while the keyboard is up.
   */
  compact?: boolean;
  onShowArt?: () => void;
  /** The drawing's side; by default 200 in a column and 152 in a phone's band. */
  size?: number;
  /** The drawing, and a key that changes when it does: a new one fades in over the old with a small bounce. */
  art: ReactNode;
  artKey: string;
  /** What the drawing is: "Sketch of the drink so far". */
  artLabel: string;
  /**
   * Under the drawing: what's being added, if it needs saying ("House-made"),
   * and a note ("Updates as you go"). Never "Sketch": a drawing is obviously a drawing.
   */
  tag?: string;
  note?: string;
  /** Under the drawing, before the tag: a control for it (the drink's Colour). */
  action?: ReactNode;
  /**
   * A photo of the drink (E26). The full band shows it in place of the
   * drawing, with the controls on dark glass; the compact band stays on paper
   * with the photo as its thumbnail.
   */
  photo?: string | null;
}

/**
 * The paper band at the top of every add wizard: back, progress, and a
 * drawing of the thing being added that redraws as it's filled in.
 */
export function PaperBand({ progress, first, backTo, onBack, top, side, rounded, folded, compact, onShowArt, size: sizeProp, art, artKey, artLabel, tag, note = 'Updates as you go', action, trail, photo }: PaperBandProps) {
  const ds = useDs();
  const onPhoto = !!photo && !compact;
  const ink = onPhoto ? backbar.dark.ink : ds.c.sketchInk;
  const glass = onPhoto ? backbar.dark.glass : backbar.light.glass;
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
  const size = compact ? THUMB : (sizeProp ?? (rounded ? 200 : 152));
  const backTitled = first && backTo;

  const back = backTitled ? (
    <PressableScale onPress={onBack} accessibilityLabel={`Back to ${backTo}`} style={[styles.backTo, { backgroundColor: glass }]}>
      <IconSymbol name="chevron.left" size={18} color={ink} />
      <Caption color={ink} numberOfLines={1} style={styles.backToLabel}>
        {backTo}
      </Caption>
    </PressableScale>
  ) : (
    <PressableScale onPress={onBack} accessibilityLabel={first ? 'Close. Your draft is kept' : 'Back'} style={[styles.back, { backgroundColor: glass }]}>
      <IconSymbol name={first ? 'xmark' : 'chevron.left'} size={18} color={ink} />
    </PressableScale>
  );
  const track = backTitled ? null : (
    <View
      style={[styles.track, compact && styles.trackCompact, { backgroundColor: withAlpha(ink, 0.15) }]}
      role="progressbar"
      accessibilityLabel="Progress"
      aria-valuemin={0}
      aria-valuemax={progress.of}
      aria-valuenow={progress.now}
    >
      <View style={[styles.fill, { backgroundColor: ink, width: `${(progress.now / progress.of) * 100}%` }]} />
    </View>
  );
  const label = (
    <Caption color={ink} style={[styles.mono, styles.label]} numberOfLines={1}>
      {progress.label}
    </Caption>
  );
  const drawing = (
    // Over a photo the drawing's room stays, empty, so the band keeps its height.
    <Animated.View style={[compact ? null : styles.drawing, { width: size, height: size }, bounce, onPhoto ? styles.hidden : null]} aria-label={compact || onPhoto ? undefined : artLabel} aria-hidden={onPhoto}>
      {shown.before ? (
        <Layer key={`out-${shown.n - 1}`} from={1} to={0}>
          {shown.before}
        </Layer>
      ) : null}
      <Layer key={`in-${shown.n}`} from={0} to={1}>
        {art}
      </Layer>
    </Animated.View>
  );
  const trailRow = trail ? (
    <View style={styles.trail}>
      <Trail items={trail} color={ink} />
    </View>
  ) : null;

  return (
    <View style={[styles.band, { backgroundColor: onPhoto ? backbar.dark.ground : ds.c.paper, paddingTop: top, paddingHorizontal: side }, rounded && styles.rounded]}>
      {onPhoto ? <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel="Photo of the drink, the hero" /> : null}
      {/* Android draws the band under the status bar: dark icons, so they read on paper in both themes; light over a photo. */}
      {Platform.OS === 'android' && !rounded ? <StatusBar style={onPhoto ? 'light' : 'dark'} /> : null}
      {compact ? (
        <>
          <View style={styles.controls}>
            {back}
            <PressableScale onPress={onShowArt} accessibilityLabel={photo ? 'Show the photo full size' : `Show the drawing full size: ${artLabel}`} style={[styles.thumb, { backgroundColor: backbar.light.glass }]}>
              {photo ? <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" /> : drawing}
            </PressableScale>
            <View style={styles.progress}>
              {track}
              {label}
            </View>
            {action}
          </View>
          {trailRow}
          <ViewAsPill ink={ink} />
        </>
      ) : (
        <>
          <View style={styles.controls}>
            {back}
            {backTitled ? <View style={styles.spacer} /> : track}
            {label}
          </View>
          {trailRow}
          {folded ? null : (
            <>
              {drawing}
              <View style={styles.foot}>
                {action}
                {tag ? <Tag label={tag} tone="paper" /> : null}
                <Caption color={ink} style={styles.mono}>
                  {note}
                </Caption>
              </View>
              <ViewAsPill ink={ink} />
            </>
          )}
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
  trail: { alignSelf: 'stretch', marginTop: space.xs },
  band: { paddingBottom: space.md, alignItems: 'center' },
  rounded: { borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' },
  controls: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: space.md },
  back: { width: layout.minTapTarget, height: layout.minTapTarget, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  backTo: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: layout.minTapTarget, paddingLeft: space.sm, paddingRight: space.md, borderRadius: radius.pill, flexShrink: 1 },
  backToLabel: { fontFamily: fontFamilies.bodyMedium, flexShrink: 1 },
  spacer: { flex: 1 },
  // The bar keeps some length however long the label is; the label gives way.
  track: { flex: 1, minWidth: layout.minTapTarget, height: 4, borderRadius: radius.pill, overflow: 'hidden' },
  label: { flexShrink: 1 },
  thumb: { width: THUMB + space.xs, height: THUMB + space.sm, borderRadius: radius.control, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  progress: { flex: 1, gap: space.sm },
  // In the compact column the bar is a row of its own, not beside the label.
  trackCompact: { flex: 0, alignSelf: 'stretch' },
  fill: { height: 4, borderRadius: radius.pill },
  mono: { fontFamily: fontFamilies.monoMedium },
  drawing: { marginTop: space.sm },
  hidden: { opacity: 0 },
  foot: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
