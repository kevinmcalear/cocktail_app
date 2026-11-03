import { useNavigation } from 'expo-router';
import type { NativeStackNavigationOptions } from 'expo-router/native-stack';
import { isValidElement, useLayoutEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { type SharedValue } from 'react-native-reanimated';

import { BackbarTheme, DsText, useDs } from '@/components/ds';
import { displayFaces, space } from '@/constants/tokens';

import { BarButton } from './MaterialBar';
import { useSmallTitle } from './PageControls';
import { useItemBack } from './useItemBack';

/** What a bar holds on its right: the page's one … (ItemMoreMenu), with Edit, Save, Share and the rest inside (Kevin's C12, 3 Nov). */
export interface Controls {
  more?: ReactNode;
}

/** Where the glyph sits beside the system's Back, iOS's glass circle (board Draw-scroll). */
export const NATIVE_DOCK_LEFT = 70;

interface ItemHeaderProps {
  name: string;
  /** iOS's system bar, or none (the rest draw theirs; the title below still applies). */
  on: boolean;
  /** Beside a list or in the editor's preview: this page isn't its screen, so it leaves the stack's options alone. */
  pane?: boolean;
  controls: Controls;
}

/**
 * The native bar on drink and item pages (boards Decided-scroll-dock-*): Back
 * (the board's glass circle), then the dock glyph and the small title, then
 * the page's one … (ItemMoreMenu). The bar floats, so the page runs under it as drawn.
 *
 * iOS can't draw this in the bar: its title is always centred, and a left bar
 * item wide enough for a name pushes the right items into the system's
 * overflow, where More disappears. So on iOS the page draws the glyph and the
 * small title under the clear bar (IosBarName) and the bar holds only Back and
 * the …. Android draws its own bar (MaterialBar).
 *
 * Every page sets `title` whatever the platform: it's what Back says on the
 * page above this one.
 */
export function useItemHeader({ name, on, pane, controls }: ItemHeaderProps) {
  const navigation = useNavigation();
  const ds = useDs();
  // Back is the board's own glass circle, always (Kevin, 3 Nov: "there is no back button"): the system's is drawn
  // only when the stack has a page under this one (useItemBack). The edge swipe still goes back where it can.
  const back = useItemBack();
  const latestBack = useRef(back);

  // setOptions renders the stack, and so this page: options change only with what they show, and Back taps through to the latest handler.
  useLayoutEffect(() => {
    latestBack.current = back;
  });
  const { more } = controls;
  // ponytail: a node's identity changes every render, so More is compared by its plain props. A More whose only change is a closure keeps the old one.
  const moreKey = isValidElement<Record<string, unknown>>(more) ? Object.values(more.props).filter((v) => typeof v !== 'function' && typeof v !== 'object').join('|') : !!more;

  useLayoutEffect(() => {
    if (pane) return;
    const theme = (node: ReactNode) => <BackbarTheme scheme={ds.scheme}>{node}</BackbarTheme>;
    const options: NativeStackNavigationOptions = !on
      ? { headerShown: false, title: name }
      : {
          headerShown: true,
          headerTransparent: true,
          headerShadowVisible: false,
          headerTintColor: ds.c.ink,
          title: name,
          headerBackVisible: false,
          // An item, not headerLeft: iOS 26 puts a headerLeft in its own glass, around the button's glass.
          unstable_headerLeftItems: () => [{ type: 'custom', element: <>{theme(<BarButton accessibilityLabel="Back" icon="chevron.left" onPress={() => latestBack.current()} />)}</>, hidesSharedBackground: true }],
          headerUserInterfaceStyle: ds.scheme,
          // The page draws the board's own backing once it slides under the bar, not iOS 26's edge blur over the sky.
          scrollEdgeEffects: { top: 'hidden' },
          headerTitle: () => <View />,
          // Its own sheet and button: a custom item, the button drawing its glass.
          unstable_headerRightItems: () => (more ? [{ type: 'custom', element: <>{theme(more)}</>, hidesSharedBackground: true }] : []),
        };
    navigation.setOptions(options);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- by value: see `latestBack` and `moreKey`.
  }, [navigation, pane, on, name, ds.scheme, ds.c.ink, moreKey]);

  // Editing in place takes over the same screen: it draws its own top, so the bar goes with this page.
  useLayoutEffect(() => {
    if (pane) return;
    return () => navigation.setOptions({ headerShown: false });
  }, [navigation, pane]);
}

/**
 * The room the bar's … takes on iOS, for IosBarName: the bar's edge, the
 * glass circle and a gap before it, so the title is cut before it reaches it.
 * iOS 26's circles are 48 across, 14 apart (measured on an iPhone, Kevin, 3 Nov).
 */
export const iosBarRoom = ({ more }: Controls) => IOS_EDGE + (more ? IOS_ITEM + IOS_ITEM_GAP : 0);

/** The small title on iOS: in the page, under the clear bar, so it can't take room from the bar's items. */
export function IosBarName({ name, left, right, top, height, scrollY, tuck }: { name: string; left: number; right: number; top: number; height: number; scrollY: SharedValue<number>; tuck: number }) {
  const ds = useDs();
  const small = useSmallTitle(scrollY, tuck);
  return (
    <Animated.View style={[styles.iosName, { left, right, top, height }, small]} aria-hidden>
      <DsText variant="headline" numberOfLines={1} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
        {name}
      </DsText>
    </Animated.View>
  );
}

/** iOS 26's bar: its edge inset, a glass item and the gap between two. */
const IOS_EDGE = space.lg;
const IOS_ITEM = 48;
const IOS_ITEM_GAP = 14;

const styles = StyleSheet.create({
  iosName: { position: 'absolute', justifyContent: 'center', pointerEvents: 'none' },
});
