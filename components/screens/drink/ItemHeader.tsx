import { useNavigation } from 'expo-router';
import type { NativeStackHeaderItem, NativeStackNavigationOptions } from 'expo-router/native-stack';
import { isValidElement, useLayoutEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { interpolate, useAnimatedReaction, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { BackbarTheme, DsText, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, layout, space } from '@/constants/tokens';

import { DOCK_SCROLL, DOCKED, dockFade } from './DrawingHero';
import { barRoom, useSmallTitle, type PageControls } from './PageControls';

export type Controls = Pick<ComponentProps<typeof PageControls>, 'save' | 'onShare' | 'onEdit' | 'editLabel' | 'more'>;

/** Where the glyph sits beside the system's Back: iOS's glass circle, Android's arrow (boards Draw-scroll, And-page). */
export const NATIVE_DOCK_LEFT = Platform.OS === 'android' ? 56 : 70;

interface ItemHeaderProps {
  name: string;
  /** The system's bar, or none (the web and a wide iPad draw PageControls; the title below still applies). */
  on: boolean;
  /** Beside a list or in the editor's preview: this page isn't its screen, so it leaves the stack's options alone. */
  pane?: boolean;
  /** The still drawing for the bar. Null on a photo page: it has only the small title. */
  glyph: ReactNode | null;
  scrollY: SharedValue<number>;
  tuck: number;
  controls: Controls;
}

/**
 * The native bar on drink and item pages (boards Decided-scroll-dock-*): the
 * system's Back, then the dock glyph and the small title, then the page's
 * tools. The bar floats, so the page runs under it as drawn.
 *
 * iOS can't draw this with a title view: its title is always centred, and the
 * board puts the glyph beside Back. So they sit in a left bar item beside the
 * back button (headerBackVisible), with the shared glass off. On Android the
 * Material bar's title does the job. A bar item can't grow out of the page, so
 * the big drawing stays over the page until it reaches this spot, and the two
 * cross-fade over the last points of the Dock (dockFade).
 *
 * Every page sets `title` whatever the platform: it's what Back says on the
 * page above this one.
 */
export function useItemHeader({ name, on, pane, glyph, scrollY, tuck, controls }: ItemHeaderProps) {
  const navigation = useNavigation();
  const ds = useDs();
  const windowWidth = useWindowDimensions().width;
  // The glyph joins the bar near the end of the Dock, so a page at rest doesn't draw its drawing twice.
  const [docking, setDocking] = useState(false);
  useAnimatedReaction(
    () => scrollY.get() > DOCK_SCROLL * 0.75,
    (now, was) => {
      if (now !== was) scheduleOnRN(setDocking, now);
    },
  );

  // setOptions renders the stack, and so this page: options change only with what they show, and tap through to the latest handlers.
  const latest = useRef(controls);
  useLayoutEffect(() => {
    latest.current = controls;
  });
  const { save, onShare, onEdit, editLabel, more } = controls;
  const room = Platform.OS === 'android' ? androidRoom(controls) : barRoom(controls);
  const docked = !!glyph;
  // ponytail: a node's identity changes every render, so More is compared by its plain props. A More whose only change is a closure keeps the old one.
  const moreKey = isValidElement<Record<string, unknown>>(more) ? Object.values(more.props).filter((v) => typeof v !== 'function' && typeof v !== 'object').join('|') : !!more;

  useLayoutEffect(() => {
    if (pane) return;
    const theme = (node: ReactNode) => <BackbarTheme scheme={ds.scheme}>{node}</BackbarTheme>;
    const title = theme(<BarTitle name={name} width={windowWidth - NATIVE_DOCK_LEFT - room - space.lg} glyph={docking ? glyph : null} docked={docked} scrollY={scrollY} tuck={tuck} />);
    const tools: Controls = {
      save: save && { ...save, onToggle: () => latest.current.save?.onToggle() },
      onShare: onShare && (() => latest.current.onShare?.()),
      onEdit: onEdit && (() => latest.current.onEdit?.()),
      editLabel,
      more,
    };
    const shared: NativeStackNavigationOptions = { headerShown: true, headerTransparent: true, headerShadowVisible: false, headerTintColor: ds.c.ink, title: name };
    const options: NativeStackNavigationOptions = !on
      ? { headerShown: false, title: name }
      : Platform.OS === 'ios'
        ? {
            ...shared,
            headerBackVisible: true,
            headerBackButtonDisplayMode: 'minimal',
            headerUserInterfaceStyle: ds.scheme,
            // The page draws the board's own backing once it slides under the bar, not iOS 26's edge blur over the sky.
            scrollEdgeEffects: { top: 'hidden' },
            headerTitle: () => <View />,
            unstable_headerLeftItems: () => [{ type: 'custom', element: <>{title}</>, hidesSharedBackground: true }],
            unstable_headerRightItems: () => rightItems(tools, ds.c.ink, ds.c.ground, theme),
          }
        : { ...shared, headerTitle: () => title, headerRight: () => theme(<RightIcons controls={tools} />) };
    navigation.setOptions(options);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- by value: see `latest` and `moreKey`; glyph joins with docking.
  }, [navigation, pane, on, name, docking, docked, windowWidth, room, tuck, scrollY, ds.scheme, ds.c.ink, ds.c.ground, save?.saved, save?.icon, save?.label[0], save?.label[1], !!onShare, !!onEdit, editLabel, moreKey]);

  // Editing in place takes over the same screen: it draws its own top, so the bar goes with this page.
  useLayoutEffect(() => {
    if (pane) return;
    return () => navigation.setOptions({ headerShown: false });
  }, [navigation, pane]);
}

/** iOS's right side: real bar buttons, each in its own glass as the board draws them, Edit filled in the ink. */
function rightItems({ save, onShare, onEdit, editLabel = 'Edit', more }: Controls, ink: string, ground: string, theme: (node: ReactNode) => ReactNode): NativeStackHeaderItem[] {
  const items: NativeStackHeaderItem[] = [];
  if (save) {
    const glyph = save.icon === 'heart' ? 'heart' : 'bookmark';
    items.push({
      type: 'button',
      label: save.label[save.saved ? 1 : 0],
      icon: { type: 'sfSymbol', name: save.saved ? `${glyph}.fill` : glyph },
      tintColor: ink,
      sharesBackground: false,
      onPress: save.onToggle,
    });
  }
  if (onShare) items.push({ type: 'button', label: 'Share', icon: { type: 'sfSymbol', name: 'square.and.arrow.up' }, tintColor: ink, sharesBackground: false, onPress: onShare });
  if (onEdit) items.push({ type: 'button', label: 'Edit', accessibilityLabel: editLabel, variant: 'prominent', tintColor: ink, labelStyle: { color: ground }, sharesBackground: false, onPress: onEdit });
  // Its own sheet and button: a custom item, the button drawing its glass.
  if (more) items.push({ type: 'custom', element: <>{theme(more)}</>, hidesSharedBackground: true });
  return items;
}

/** The width of Android's right side (RightIcons): 48 dp icons, Edit as text. */
function androidRoom({ save, onShare, onEdit, more }: Controls) {
  return [save, onShare, more].filter(Boolean).length * ICON + (onEdit ? EDIT_TEXT : 0);
}

/** Android's right side: plain icon buttons (And-page: "Back and Share are plain icon buttons"), Edit a labelled one. */
function RightIcons({ controls: { save, onShare, onEdit, editLabel = 'Edit', more } }: { controls: Controls }) {
  const ds = useDs();
  return (
    <View style={styles.right}>
      {save ? <IconButton label={save.label[save.saved ? 1 : 0]} icon={save.icon === 'heart' ? (save.saved ? 'heart.fill' : 'heart') : save.saved ? 'bookmark.fill' : 'bookmark'} onPress={save.onToggle} /> : null}
      {onEdit ? (
        <PressableScale accessibilityLabel={editLabel} onPress={onEdit} style={styles.edit}>
          <DsText variant="caption" color={ds.c.ink}>
            Edit
          </DsText>
        </PressableScale>
      ) : null}
      {onShare ? <IconButton label="Share" icon="square.and.arrow.up" onPress={onShare} /> : null}
      {more}
    </View>
  );
}

function IconButton({ label, icon, onPress }: { label: string; icon: ComponentProps<typeof IconSymbol>['name']; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale accessibilityLabel={label} onPress={onPress} style={styles.icon}>
      <IconSymbol name={icon} size={24} color={ds.c.ink} />
    </PressableScale>
  );
}

/** The glyph and the small title, as the bar shows them once the page has docked. */
function BarTitle({ name, width, glyph, docked, scrollY, tuck }: { name: string; width: number; glyph: ReactNode | null; docked: boolean; scrollY: SharedValue<number>; tuck: number }) {
  const ds = useDs();
  const small = useSmallTitle(scrollY, tuck);
  const fade = dockFade(DOCK_SCROLL);
  const inBar = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.get(), fade, [0, 1], 'clamp') }));
  return (
    <View style={[styles.title, { width }]} aria-hidden>
      {/* Room held from the start, so the small title lands beside the glyph. */}
      {docked ? <Animated.View style={[styles.glyph, inBar]}>{glyph}</Animated.View> : null}
      <Animated.View style={[styles.name, small]}>
        <DsText variant="headline" numberOfLines={1} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
          {name}
        </DsText>
      </Animated.View>
    </View>
  );
}

const ICON = layout.minTapTarget + space.xs;
/** "Edit" in the caption face with its padding. */
const EDIT_TEXT = 64;

const styles = StyleSheet.create({
  title: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  glyph: { width: DOCKED, height: DOCKED },
  name: { flex: 1 },
  right: { flexDirection: 'row', alignItems: 'center' },
  icon: { width: ICON, height: ICON, alignItems: 'center', justifyContent: 'center' },
  edit: { height: space.xl + space.lg, minWidth: EDIT_TEXT, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
});
