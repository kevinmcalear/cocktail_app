import { createContext, use, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type ViewProps } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { Body, Caption, PressableScale, Title, useDs } from '@/components/ds';
import { useTabBarTop } from '@/components/nav/WebTabBar';
import { fontFamilies, radius, space, type } from '@/constants/tokens';

/** How far up (0 = the one line, 1 = the next stop) the line has gone and the page has come in. */
export const CROSSFADE = 0.35;

/** The sheet's ground: the surface, edge to edge, its top corners rounded, lifted off the map. */
export function SheetGround({ style }: Pick<ViewProps, 'style'>) {
  const ds = useDs();
  return <View pointerEvents="none" style={[style, styles.ground, { backgroundColor: ds.c.surface, shadowColor: ds.c.ground }]} />;
}

/**
 * The phone map's sheet, docked (disc-map-sheet, approved 24 Oct): edge to
 * edge from the bottom of the screen, running under a floating tab bar, as
 * Google Maps' does. At rest it's one line on the tab bar. Spread `sheet` on
 * the BottomSheet and put `box` on the view that holds it. `foot`: the room
 * the tab bar takes at its bottom. `inset` is the map in view around them.
 */
export function useMapSheetChrome() {
  const foot = useTabBarTop();
  const [controls, setControls] = useState(0);
  return {
    box: styles.box,
    foot,
    sheet: { backgroundComponent: SheetGround },
    /** Spread on the box holding the controls over the map, which measures them. */
    controls: { style: styles.controls, onLayout: (e: LayoutChangeEvent) => setControls(Math.round(e.nativeEvent.layout.height)) },
    /** The map left showing between the controls (starting `top` down) and the sheet at rest (`peek` tall), where the camera centres, as Google Maps does. */
    inset: (top: number, peek: number) => ({ top: top + controls, bottom: peek }),
  };
}

/**
 * The search field over the sheet's line (SheetSearch, Q29). A context, not a
 * prop: the handle must keep one identity (a new one remounts it), and the
 * field's handlers change as the search does.
 */
export const SheetSearchSlot = createContext<ReactNode>(null);

interface SheetLineProps {
  animatedIndex: SharedValue<number>;
  /** None while a tapped bar's card leads: it has its own name. */
  title: string | null;
  count: string;
  /** A tap opens the sheet, for anyone who taps rather than swipes. */
  onOpen: () => void;
  /** The grabber and line's height: the sheet's peek. */
  onMeasure: (height: number) => void;
}

/**
 * The sheet's handle: the grabber, the search field on phones' Discover, then one line, "Drinks in this area" and
 * "229 bars", which gives way to the display title as the sheet rises. Being
 * the handle, the title stays put as the list under it scrolls.
 */
export function SheetLine({ animatedIndex, title, count, onOpen, onMeasure }: SheetLineProps) {
  const search = use(SheetSearchSlot);
  const line = useAnimatedStyle(() => ({ opacity: interpolate(animatedIndex.value, [0, CROSSFADE], [1, 0], Extrapolation.CLAMP) }));
  const big = useAnimatedStyle(() => ({ opacity: interpolate(animatedIndex.value, [0, CROSSFADE], [0, 1], Extrapolation.CLAMP) }));
  return (
    <View onLayout={(e) => onMeasure(Math.ceil(e.nativeEvent.layout.height))}>
      <Grabber />
      {search ? <View style={styles.search}>{search}</View> : null}
      {title ? (
        <View style={styles.row}>
          {/* The line below says the same to a screen reader, and opens the sheet. */}
          <Animated.View pointerEvents="none" aria-hidden style={[StyleSheet.absoluteFill, styles.big, big]}>
            <Title numberOfLines={1}>
              {title}
            </Title>
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, line]}>
            <PressableScale role="button" accessibilityLabel={`${title}${count ? `, ${count}` : ''}. Show the list`} onPress={onOpen} style={styles.line}>
              <Body numberOfLines={1} style={styles.title}>
                {title}
              </Body>
              {count ? (
                <Caption tone="muted" numberOfLines={1}>
                  {count}
                </Caption>
              ) : null}
            </PressableScale>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

/** The sheet's grabber, the bar at its top. */
export function Grabber() {
  const ds = useDs();
  return (
    <View style={styles.grabber}>
      <View style={[styles.indicator, { backgroundColor: ds.c.lineStrong }]} />
    </View>
  );
}

/** The page under the handle: hidden at rest (it would sit behind the tab bar), in as the sheet rises. */
export function usePageFade(animatedIndex: SharedValue<number>) {
  return useAnimatedStyle(() => ({ opacity: interpolate(animatedIndex.value, [0, CROSSFADE], [0, 1], Extrapolation.CLAMP) }));
}

const styles = StyleSheet.create({
  box: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  ground: { borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.35, shadowRadius: 18, elevation: 12 },
  grabber: { alignItems: 'center', paddingTop: space.sm, paddingBottom: space.sm },
  search: { paddingHorizontal: space.lg, paddingBottom: space.sm },
  indicator: { width: space.xxl, height: space.xs, borderRadius: radius.pill },
  // As tall as the display title, so the one line and the title trade places without the sheet moving.
  row: { height: type.title.lineHeight + space.sm },
  big: { paddingHorizontal: space.lg, justifyContent: 'flex-end', paddingBottom: space.xs },
  line: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingBottom: space.sm },
  title: { flex: 1, minWidth: 0, fontFamily: fontFamilies.bodySemiBold },
  controls: { gap: space.sm },
});
