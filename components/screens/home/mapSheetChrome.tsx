import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type ViewProps } from 'react-native';

import { GlassSurface, useDs } from '@/components/ds';
import { TAB_PILL, useTabBarTop } from '@/components/nav/WebTabBar';
import { space } from '@/constants/tokens';

/** The sheet's grabber: a short bar with a little room above and below. */
export const SHEET_HANDLE = space.sm + space.xs + space.xs;

/** Glass, as the tab pill under it (liquid glass on iOS 26, the blur or raised surface elsewhere). */
function SheetGlass({ style }: Pick<ViewProps, 'style'>) {
  return (
    <View pointerEvents="none" style={style}>
      <GlassSurface style={styles.glass}>{null}</GlassSurface>
    </View>
  );
}

/**
 * The phone map's drinks sheet as part of the bottom bar's family (Eddie,
 * 13 Oct: "attached to it and coming up from it"): the tab pill's sides,
 * corners and glass, a small grabber, and its box ending just above the pill,
 * so the collapsed sheet sits on it. Spread `sheet` on the BottomSheet and
 * put `box` on the view that clips it. `inset` is the map in view around them.
 */
export function useMapSheetChrome() {
  const ds = useDs();
  const bottom = useTabBarTop() + space.sm;
  const [controls, setControls] = useState(0);
  return {
    box: { left: TAB_PILL.inset, right: TAB_PILL.inset, bottom, borderBottomLeftRadius: TAB_PILL.radius, borderBottomRightRadius: TAB_PILL.radius },
    sheet: {
      backgroundComponent: SheetGlass,
      handleStyle: styles.handle,
      handleIndicatorStyle: [styles.indicator, { backgroundColor: ds.c.lineStrong }],
    },
    /** Spread on the box holding the controls over the map, which measures them. */
    controls: { style: styles.controls, onLayout: (e: LayoutChangeEvent) => setControls(Math.round(e.nativeEvent.layout.height)) },
    /** The map left showing between the controls (starting `top` down) and the collapsed sheet (`peek` tall), where the camera centres, as Google Maps does. */
    inset: (top: number, peek: number) => ({ top: top + controls, bottom: bottom + peek }),
  };
}

const styles = StyleSheet.create({
  glass: { flex: 1, borderRadius: TAB_PILL.radius },
  handle: { paddingTop: space.sm, paddingBottom: space.xs },
  indicator: { width: space.xxl, height: space.xs },
  controls: { gap: space.sm },
});
