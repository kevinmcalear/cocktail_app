import { useState, type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';

import { useDs, useGutter } from '@/components/ds';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { space } from '@/constants/tokens';

import { COLUMNS_FROM, DrinkColumns } from './DrinkColumns';
import { phoneHeroHeight } from './DrinkHero';
import { DockedDrawing, DOCKED, DrawingSpace, DrinkSky, drawingTop } from './DrawingHero';
import { PageControls } from './PageControls';
import { PhotoMirror } from './PhotoMirror';

type Controls = Pick<ComponentProps<typeof PageControls>, 'save' | 'onShare' | 'onEdit' | 'editLabel' | 'more'>;

interface ItemShellProps {
  name: string;
  top: number;
  /** Beside a list or in the editor's preview: no Back, and one column. */
  pane?: boolean;
  /** A photo leads full bleed (its hero at a height, faded on phones); else the drawing on its sky. */
  photo: { url: string | number; hero: (height: number, fade: boolean) => ReactNode } | null;
  /** The drawing, drawn at `size`. */
  art: ReactNode;
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
export function ItemShell({ name, top, pane, photo, art, size, liquid, title, action, body, controls, children }: ItemShellProps) {
  const ds = useDs();
  const gutter = useGutter();
  // Clear of the floating tab bar: these routes sit in each tab's stack.
  const tabInset = useTabBarInset();
  const { width: windowWidth, height } = useWindowDimensions();
  // The pane's own width: beside the Drinks list a 1300 window leaves about 600 (desk split, #1047).
  const [width, setWidth] = useState(windowWidth);
  const columns = !pane && width >= COLUMNS_FROM;
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => scrollY.set(e.contentOffset.y));
  const heroHeight = photo ? phoneHeroHeight(width, height, top) : drawingTop(top) + size + space.lg;
  // Up to 400 on a wide screen, shrinking with a short window down to 220, so the side never scrolls.
  const wideSize = Math.min(400, Math.max(220, height - 440));
  const bar = (phone: boolean) => (
    <PageControls
      top={top}
      scrollY={scrollY}
      tuck={phone ? heroHeight + space.xxxl : Number.MAX_SAFE_INTEGER}
      title={phone ? name : ''}
      titleInset={photo || !phone ? 0 : DOCKED + space.sm}
      noBack={pane}
      backLabel={columns ? 'Back' : undefined}
      {...controls}
    >
      {!photo && phone ? <DockedDrawing art={art} size={size} top={top} width={width} gutter={gutter} scrollY={scrollY} /> : null}
    </PageControls>
  );

  return (
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
                    <View style={{ transform: [{ scale: wideSize / size }], transformOrigin: 'center top' }}>{art}</View>
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
          {bar(false)}
        </>
      ) : (
        <>
          <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={[styles.column, { paddingBottom: tabInset + space.xxl }]}>
            {photo ? <PhotoMirror url={photo.url} top={heroHeight - space.xxxl} /> : <DrinkSky liquid={liquid} />}
            {photo ? photo.hero(heroHeight, true) : <DrawingSpace top={top} size={size} />}
            <View style={{ paddingHorizontal: gutter, marginTop: photo ? -space.xxl : 0 }}>{body(false)}</View>
          </Animated.ScrollView>
          {bar(true)}
        </>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // The phone page in a wider column from 768 to the split (desktop board: up to 680).
  column: { width: '100%', maxWidth: 680, alignSelf: 'center' },
  centre: { alignItems: 'center' },
  photoHead: { gap: space.xl, marginBottom: space.xl },
});
