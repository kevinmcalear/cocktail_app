import { HeaderBackContext, HeaderHeightContext } from 'expo-router/react-navigation';
import { StatusBar } from 'expo-status-bar';
import { use, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedReaction, useAnimatedScrollHandler, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { ExtendedFab, useDs, useGutter } from '@/components/ds';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { layout, space } from '@/constants/tokens';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import type { TextZone } from '@/lib/itemImages';
import { TITLE_ROOM, titleSpot } from '@/lib/photoTitle';
import { backWord } from '@/lib/tabs';

import { COLUMNS_FROM, DrinkColumns } from './DrinkColumns';
import { FADE, phoneHeroHeight } from './DrinkHero';
import { DockedDrawing, DockGlyph, DOCKED, DrawingSpace, DrinkSky, drawingTop } from './DrawingHero';
import { NATIVE_DOCK_LEFT, useItemHeader, type Controls } from './ItemHeader';
import { backWidth, BarBacking, PageControls } from './PageControls';
import { TitleOnPhoto } from './ItemTitle';
import { PhotoMirror } from './PhotoMirror';

interface ItemShellProps {
  name: string;
  /** Beside a list or in the editor's preview: no Back, and one column. */
  pane?: boolean;
  /**
   * A photo leads full bleed (its hero at a height, faded on phones); else the
   * drawing on its sky. Its quiet room (`zone`, with its `aspect`) takes the
   * title where there's room and it reads there (lib/photoTitle.ts).
   */
  photo: { url: string | number; hero: (height: number, fade: boolean) => ReactNode; zone?: TextZone | null; aspect?: number | null } | null;
  /** The drawing, drawn at `size`. `pour` off for its still copy in the bar. */
  art: (pour?: boolean) => ReactNode;
  size: number;
  /** The sky's colour: the drink's liquid, the beer's, the syrup's. */
  liquid: string | null;
  /** The eyebrow, name and credit. */
  title: ReactNode;
  /** The one prominent action (Rank it, Log batch), or null. */
  action: ReactNode;
  /** The blocks. `columns`: beside the sticky side, which holds the action. `titled`: the title is the body's to show. */
  body: (columns: boolean, titled: boolean) => ReactNode;
  controls: Controls;
  /** Android's phone page: the one main action as the extended FAB. The body drops its button (`columns` stays inline). */
  fab?: { label: string; accessibilityLabel: string; onPress: () => void } | null;
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
  const heroHeight = photo ? phoneHeroHeight(width, height, top) : drawingTop(top) + size + space.lg;
  // Up to 400 on a wide screen, shrinking with a short window down to 220, so the side never scrolls.
  const wideSize = Math.min(400, Math.max(220, height - 440));
  const bar = top + layout.minTapTarget + space.sm * 2;
  // Solid by the time the page's first line slides under the bar (top + controls), as the board's bar does.
  const tuck = heroHeight - bar + space.lg;
  // The title in the photo's quiet room, or null: under the photo, or on a wide page at the top of the spec.
  const spot = !photo
    ? null
    : columns
      ? titleSpot({ zone: photo.zone, aspect: photo.aspect, width: layout.photoPanel, height, from: bar, to: height, muted: ds.c.muted })
      : titleSpot({ zone: photo.zone, aspect: photo.aspect, width: Math.min(width, COLUMN), height: heroHeight, from: bar, to: heroHeight - FADE, muted: ds.c.muted });
  // A title in the photo scrolls off with it (boards Decided-photo-top, -scrolled): the small one comes as it goes under the bar.
  const smallAt = spot === null ? tuck : spot + TITLE_ROOM - bar - space.xl;
  // Phones have the system's bar. The web and a wide iPad's two columns draw theirs (PageControls).
  const nativeBar = Platform.OS !== 'web' && !columns && !pane;
  useItemHeader({ name, on: nativeBar, pane, glyph: photo ? null : <DockGlyph art={art(false)} size={size} />, scrollY, smallAt, controls });
  const barHeight = use(HeaderHeightContext) ?? 0;
  // Where it goes, from the page under this one, where there's room for a label (desktop boards).
  const under = use(HeaderBackContext)?.title;
  const backLabel = columns || (Platform.OS === 'web' && wide) ? backWord(under) : undefined;
  const dock = (over: { dockLeft: number; dockTop: number; handOff?: boolean }) => <DockedDrawing art={art()} size={size} top={top} width={width} scrollY={scrollY} {...over} />;
  const drawnBar = (phone: boolean) => (
    <PageControls top={top} scrollY={scrollY} tuck={phone ? tuck : Number.MAX_SAFE_INTEGER} smallAt={phone ? smallAt : Number.MAX_SAFE_INTEGER} title={phone ? name : ''} titleInset={photo || !phone ? 0 : DOCKED + space.sm} noBack={pane} backLabel={backLabel} {...controls}>
      {!photo && phone ? dock({ dockLeft: gutter + backWidth(backLabel) + space.sm, dockTop: top + space.sm + (layout.minTapTarget - DOCKED) / 2 }) : null}
    </PageControls>
  );
  // The page's half of the native bar: its backing and the drawing on its way up to the bar's glyph.
  const underNativeBar = (
    <>
      <BarBacking height={barHeight} scrollY={scrollY} tuck={tuck} />
      {photo ? null : dock({ dockLeft: NATIVE_DOCK_LEFT, dockTop: (top + barHeight - DOCKED) / 2, handOff: true })}
    </>
  );

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {/* The photo decides the system bars too, not the phone's mode (board And-photo-bright). */}
      {photo && !pane ? <StatusBar style={ds.scheme === 'dark' ? 'light' : 'dark'} /> : null}
      {columns ? (
        <>
          <DrinkColumns
            photo={!!photo}
            top={top}
            gutter={gutter}
            behind={photo ? <PhotoMirror url={photo.url} left={layout.photoPanel} /> : <DrinkSky liquid={liquid} tall />}
            side={
              photo ? (
                <>
                  {photo.hero(height, false)}
                  {spot === null ? null : (
                    <TitleOnPhoto.Provider value={ds.scheme === 'dark'}>
                      <View style={[styles.photoTitle, styles.sideTitle, { top: spot + space.lg }]}>
                        {title}
                        {action}
                      </View>
                    </TitleOnPhoto.Provider>
                  )}
                </>
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
            {photo && spot === null ? (
              <View style={styles.photoHead}>
                {title}
                {action}
              </View>
            ) : null}
            {body(true, false)}
          </DrinkColumns>
          {drawnBar(false)}
        </>
      ) : (
        <>
          <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={[styles.column, { paddingBottom: bottom + space.xxl }]}>
            {photo ? <PhotoMirror url={photo.url} top={heroHeight} /> : <DrinkSky liquid={liquid} />}
            {photo ? photo.hero(heroHeight, true) : <DrawingSpace top={top} size={size} />}
            {spot === null ? null : <View style={[styles.photoTitle, { top: spot + space.lg, left: gutter, right: gutter }]}>{title}</View>}
            <View style={{ paddingHorizontal: gutter, marginTop: !photo ? 0 : spot === null ? -space.xxl : space.lg }}>{body(false, spot === null)}</View>
          </Animated.ScrollView>
          {nativeBar ? underNativeBar : drawnBar(true)}
          {fab ? <PageFab {...fab} scrollY={scrollY} bottom={bottom} /> : null}
        </>
      )}
      {children}
    </View>
  );
}

/** The phone page's widest column (desktop board: up to 680, from 768 to the split). */
const COLUMN = 680;

/** The extended FAB, shrinking to a round one once the page moves (board And-page). */
function PageFab({ scrollY, bottom, ...fab }: NonNullable<ItemShellProps['fab']> & { scrollY: SharedValue<number>; bottom: number }) {
  const [open, setOpen] = useState(true);
  useAnimatedReaction(
    () => scrollY.get() < 40,
    (now, was) => {
      if (now !== was) scheduleOnRN(setOpen, now);
    },
  );
  return <ExtendedFab {...fab} icon="checkmark" open={open} style={{ bottom: bottom + space.lg }} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  column: { width: '100%', maxWidth: COLUMN, alignSelf: 'center' },
  centre: { alignItems: 'center' },
  photoHead: { gap: space.xl, marginBottom: space.xl },
  // In the photo: scrolls away with it on a phone, stays on the panel from the split up.
  photoTitle: { position: 'absolute', gap: space.xl, pointerEvents: 'box-none' },
  sideTitle: { left: space.xxxl - space.sm, right: space.xxxl - space.sm },
});
