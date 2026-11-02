import { useIsFocused } from 'expo-router';
import { HeaderBackContext, HeaderHeightContext } from 'expo-router/react-navigation';
import { use, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedReaction, useAnimatedScrollHandler, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { ExtendedFab, useDs, useGutter, type FabIcon } from '@/components/ds';
import { useFabUnderToast } from '@/components/ds/Toast';
import { material } from '@/constants/material';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { layout, space } from '@/constants/tokens';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { backWord } from '@/lib/tabs';

import { COLUMNS_FROM, DrinkColumns } from './DrinkColumns';
import { phoneHeroHeight } from './DrinkHero';
import { DockedDrawing, DOCKED, DrawingSpace, DrinkSky, drawingRoom } from './DrawingHero';
import { iosBarRoom, IosBarName, NATIVE_DOCK_LEFT, useItemHeader, type Controls } from './ItemHeader';
import { MATERIAL_DOCK, MaterialBar, MaterialPage, useItemTones } from './MaterialBar';
import { backWidth, BarBacking, PageControls } from './PageControls';
import { PhotoMirror } from './PhotoMirror';

interface ItemShellProps {
  name: string;
  /** Beside a list or in the editor's preview: no Back, and one column. */
  pane?: boolean;
  /** A photo leads full bleed (its hero at a height, faded on phones); else the drawing on its sky. */
  photo: { url: string | number; hero: (height: number, fade: boolean) => ReactNode } | null;
  /** The drawing, drawn at `size`. `pour` off for its still copy in the bar. */
  art: (pour?: boolean) => ReactNode;
  size: number;
  /** The sky's colour: the drink's liquid, the beer's, the syrup's. */
  liquid: string | null;
  /** The eyebrow, name and credit. */
  title: ReactNode;
  /** The one prominent action (Rank it, Log batch), or null. */
  action: ReactNode;
  /** The blocks. `columns`: beside the sticky side, which holds the title and the action. */
  body: (columns: boolean) => ReactNode;
  controls: Controls;
  /** Android's phone page: the one main action as the extended FAB. The body drops its button (`columns` stays inline). */
  fab?: { label: string; accessibilityLabel: string; icon: FabIcon; onPress: () => void } | null;
  /** Sheets the page opens. */
  children?: ReactNode;
}

/**
 * One layout for everything you can drink or pour (canvas GWBCX, Decided and
 * Desktop and web): a cocktail, a beer, a wine, a bottle, something
 * house-made. On a phone the photo scrolls away over its mirrored blur, or the
 * drawing sits on its sky and docks into the bar. From 900 points of pane the
 * picture, name and one action stay put on the left and the rest scrolls.
 */
export function ItemShell({ name, pane, photo, art, size, liquid, title, action, body, controls, fab, children }: ItemShellProps) {
  const ds = useDs();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const tabInset = useTabBarInset();
  const top = insets.top;
  // Beside a list or in the editor's preview, no floating tab bar sits over this page.
  const bottom = pane ? insets.bottom + space.lg : tabInset;
  const wide = useIsWideWeb();
  const { width: windowWidth, height } = useWindowDimensions();
  // The pane's own width: beside the Drinks list a 1300 window leaves about 600 (desk split, #1047).
  const [width, setWidth] = useState(windowWidth);
  const columns = !pane && width >= COLUMNS_FROM;
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => scrollY.set(e.contentOffset.y));
  const heroHeight = photo ? phoneHeroHeight(width, height, top) : drawingRoom(top, size);
  // Up to 400 on a wide screen, shrinking with a short window down to 220, so the side never scrolls.
  const wideSize = Math.min(400, Math.max(220, height - 440));
  // Solid by the time the page's first line slides under the bar (top + controls), as the board's bar does.
  const tuck = heroHeight - (top + layout.minTapTarget + space.sm * 2) + space.lg;
  // iPhones have the system's bar, Android phones the Material one. The web and two columns draw theirs (PageControls).
  const nativeBar = Platform.OS === 'ios' && !columns && !pane;
  // A pane (the Library beside its list, the editor's preview) keeps the drawn controls.
  const materialBar = Platform.OS === 'android' && !columns && !pane;
  useItemHeader({ name, on: nativeBar, pane, controls });
  const barHeight = use(HeaderHeightContext) ?? 0;
  // Where it goes, from the page under this one, where there's room for a label (desktop boards).
  const under = use(HeaderBackContext)?.title;
  const backLabel = columns || (Platform.OS === 'web' && wide) ? backWord(under) : undefined;
  const dock = (over: { dockLeft: number; dockTop: number; handOff?: boolean }) => <DockedDrawing art={art()} size={size} top={top} width={width} scrollY={scrollY} {...over} />;
  const drawnBar = (phone: boolean) => (
    <PageControls top={top} scrollY={scrollY} tuck={phone ? tuck : Number.MAX_SAFE_INTEGER} title={phone ? name : ''} titleInset={photo || !phone ? 0 : DOCKED + space.sm} noBack={pane} backLabel={backLabel} {...controls}>
      {!photo && phone ? dock({ dockLeft: gutter + backWidth(backLabel) + space.sm, dockTop: top + space.sm + (layout.minTapTarget - DOCKED) / 2 }) : null}
    </PageControls>
  );
  // The page's half of the native bar: its backing and the drawing on its way up to the bar's glyph.
  const underNativeBar = (
    <>
      <BarBacking height={barHeight} scrollY={scrollY} tuck={tuck} />
      {photo ? null : dock({ dockLeft: NATIVE_DOCK_LEFT, dockTop: (top + barHeight - DOCKED) / 2 })}
      <IosBarName name={name} left={NATIVE_DOCK_LEFT + (photo ? 0 : DOCKED + space.sm)} right={space.lg + iosBarRoom(controls)} top={top} height={barHeight - top} scrollY={scrollY} tuck={tuck} />
    </>
  );

  const page = (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {columns ? (
        <>
          <DrinkColumns
            photo={!!photo}
            top={top}
            gutter={gutter}
            behind={photo ? null : <DrinkSky liquid={liquid} tall />}
            side={
              photo ? (
                photo.hero(height, false)
              ) : (
                <>
                  <View style={[styles.centre, { height: wideSize }]}>
                    <View style={{ transform: [{ scale: wideSize / size }], transformOrigin: 'center top' }}>{art()}</View>
                  </View>
                  {title}
                  {action}
                </>
              )
            }
          >
            {photo ? (
              <View style={styles.photoHead}>
                {title}
                {action}
              </View>
            ) : null}
            {body(true)}
          </DrinkColumns>
          {drawnBar(false)}
        </>
      ) : (
        <>
          <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={[styles.column, { paddingBottom: bottom + space.xxl + (fab ? FAB_ROOM : 0) }]}>
            {photo ? <PhotoMirror url={photo.url} top={heroHeight - space.xxxl} /> : <DrinkSky liquid={liquid} />}
            {photo ? photo.hero(heroHeight, true) : <DrawingSpace top={top} size={size} />}
            <View style={{ paddingHorizontal: gutter, marginTop: photo ? -space.xxl : 0 }}>{body(false)}</View>
          </Animated.ScrollView>
          {materialBar ? (
            <MaterialBar name={name} top={top} photo={!!photo} hero={heroHeight} width={width} scrollY={scrollY} noBack={pane} controls={controls} drawing={photo ? null : dock({ dockLeft: MATERIAL_DOCK.left, dockTop: top + MATERIAL_DOCK.top })} />
          ) : nativeBar ? (
            underNativeBar
          ) : (
            drawnBar(true)
          )}
          {fab ? <PageFab {...fab} scrollY={scrollY} bottom={bottom} /> : null}
        </>
      )}
      {children}
    </View>
  );
  return (
    <MaterialPage liquid={liquid} photo={!!photo} bar={materialBar} glide={materialBar && !photo ? { scrollY, top: heroHeight, left: Math.max(0, (width - COLUMN) / 2) + gutter, width: Math.min(width, COLUMN) - gutter * 2 } : null}>
      {page}
    </MaterialPage>
  );
}

/** The extended FAB, shrinking to a round one once the page moves (board And-page). */
function PageFab({ scrollY, bottom, ...fab }: NonNullable<ItemShellProps['fab']> & { scrollY: SharedValue<number>; bottom: number }) {
  const [open, setOpen] = useState(true);
  useAnimatedReaction(
    () => scrollY.get() < 40,
    (now, was) => {
      if (now !== was) scheduleOnRN(setOpen, now);
    },
  );
  const tones = useItemTones();
  // The toast goes above it, while this page is the one showing.
  useFabUnderToast(useIsFocused() ? bottom + material.fab : null);
  // `bottom` already holds the 16 dp gap (useTabBarInset, or the pane's inset + space.lg): no second one.
  return <ExtendedFab {...fab} open={open} colors={tones ? { fill: tones.fab, text: tones.onFab } : undefined} style={{ bottom }} />;
}

/** Room under the page's last line for the FAB: 56 and its margins. */
const FAB_ROOM = 88;
/** The phone page in a wider column from 768 to the split (desktop board). */
const COLUMN = 680;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  column: { width: '100%', maxWidth: COLUMN, alignSelf: 'center' },
  centre: { alignItems: 'center' },
  photoHead: { gap: space.xl, marginBottom: space.xl },
});
