import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { DsText, GlassButton, useDs, useGutter } from '@/components/ds';
import { displayFaces, layout, space, type BackbarScheme } from '@/constants/tokens';

import { useItemBack } from './useItemBack';

/** How long Back runs: its circle, or the pill with where it goes (desktop board's measure). */
export const backWidth = (label?: string) => (label ? Math.round(46 + label.length * 8.2) : layout.minTapTarget);

/** Room for what sits on the bar's right: the one … and its gap. */
const barRoom = (more: ReactNode) => (more ? layout.minTapTarget + space.sm : 0);

/** The small title once the big one (a display line, about 64) has gone under the bar. */
export function useSmallTitle(scrollY: SharedValue<number>, tuck: number) {
  return useAnimatedStyle(() => ({ opacity: interpolate(scrollY.get(), [tuck + space.xl, tuck + space.xxxl + space.sm], [0, 1], 'clamp') }));
}

/** The page's ground fading in behind the bar, solid by the time the first line reaches it. */
export function BarBacking({ height, scrollY, tuck }: { height: number; scrollY: SharedValue<number>; tuck: number }) {
  const ds = useDs();
  // None while the page is pulled past its top: the sky shows through there (ScrollSky).
  const backing = useAnimatedStyle(() => {
    const y = scrollY.get();
    return { opacity: y < 0 ? 0 : interpolate(y, [tuck - space.xxxl, tuck], [0, 1], 'clamp') };
  });
  return <Animated.View style={[styles.backing, { height, backgroundColor: ds.c.ground, borderBottomColor: ds.c.line }, backing]} />;
}

interface PageControlsProps {
  /** The glass's scheme. Left out: the page's own (a photo page already takes the photo's). */
  over?: BackbarScheme;
  top: number;
  scrollY: SharedValue<number>;
  /** The scroll offset where the page's first line reaches the bar: the backing is solid by then, the small title follows. */
  tuck: number;
  /** Where the small title starts instead, when the big one is in the photo and leaves sooner. */
  smallAt?: number;
  /** The small title in the bar. */
  title: string;
  /** Room on the title's left: a docked drawing sits there. */
  titleInset?: number;
  /** Beside a list, or at the root of nothing: no Back. */
  noBack?: boolean;
  /** A pointer has room for a label (desktop board: "Back says where it goes"). */
  backLabel?: string;
  /** The one … (ItemMoreMenu): Edit, Save, Share and the rest are in it, never beside it (Kevin, 3 Nov, and C12). */
  more?: ReactNode;
  /** Between the bar's backing and the buttons: the docked drawing. */
  children?: ReactNode;
}

/**
 * The drink and item pages' top bar (boards Draw-scroll, Photo-scroll): glass
 * Back on the left, the one … on the right. As the big title passes
 * under it, a backing in the page's ground fades in and the small title with
 * it. Nothing else: no study pile, no role switcher, no More. The web and a
 * wide iPad draw it here; phones have the same in the system's bar (ItemHeader).
 */
export function PageControls({ over, top, scrollY, tuck, smallAt = tuck, title, titleInset = 0, noBack, backLabel, more, children }: PageControlsProps) {
  const ds = useDs();
  const goBack = useItemBack();
  const gutter = useGutter();
  const barHeight = top + space.sm * 2 + layout.minTapTarget;
  const small = useSmallTitle(scrollY, smallAt);
  const back = noBack ? (
    <View />
  ) : (
    <GlassButton
      accessibilityLabel={backLabel && backLabel !== 'Back' ? `Back to ${backLabel}` : 'Back'}
      icon="chevron.left"
      label={backLabel}
      scheme={over}
      onPress={goBack}
    />
  );
  return (
    <>
      <BarBacking height={barHeight} scrollY={scrollY} tuck={tuck} />
      {children}
      <Animated.View style={[styles.title, { top: top + space.sm, height: layout.minTapTarget, left: gutter + backWidth(backLabel) + space.sm + titleInset, right: gutter + barRoom(more) }, small]} aria-hidden>
        <DsText variant="headline" numberOfLines={1} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
          {title}
        </DsText>
      </Animated.View>
      <View style={[styles.row, { top: top + space.sm, left: gutter, right: gutter }]}>
        {back}
        {more}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  backing: { position: 'absolute', top: 0, left: 0, right: 0, borderBottomWidth: StyleSheet.hairlineWidth, pointerEvents: 'none' },
  title: { position: 'absolute', justifyContent: 'center', pointerEvents: 'none' },
  row: { position: 'absolute', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
});
