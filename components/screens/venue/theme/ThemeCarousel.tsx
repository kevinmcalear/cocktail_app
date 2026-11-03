import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';

import { BackbarTheme, BrandProvider, DrinkImage, DsText, PressableScale, useDs } from '@/components/ds';
import { VenueMark } from '@/components/nav/VenueMarks';
import { DEFAULT_ACCENT, font, nameStyle, radius, space, type, type BackbarScheme } from '@/constants/tokens';
import { BRAND_SAMPLE } from '@/lib/brandSample';
import { withAlpha } from '@/lib/color';

import type { BrandLook } from '../BrandPreview';
import { MINIS, type MiniKind } from './ThemeMinis';

/** Material 3's multi-browse carousel (canvas Theme-and): one large item, a medium one, a small one peeking. */
const LARGE = 220;
const MEDIUM = 120;
const SMALL = 40;
const GAP = space.sm;
const HEIGHT = 250;
/** One item's scroll: the large one moves out as the next takes its place. */
const STEP = LARGE + GAP;
/** Where an item sits and how wide it shows, by its place: -1 gone left, 0 large, 1 medium, 2 small, 3 past the edge. */
const PLACES = [-1, 0, 1, 2, 3];
const LEFT = [-(SMALL + GAP), 0, LARGE + GAP, LARGE + MEDIUM + 2 * GAP, LARGE + MEDIUM + SMALL + 3 * GAP];
const WIDE = [SMALL, LARGE, MEDIUM, SMALL, SMALL];
/** Drawn first to last, as the board has them: the drink, then the bar. */
const ORDER: MiniKind[] = ['drawn', 'bar', 'menu', 'photo'];
const PHOTO = require('@/assets/images/cocktails/bolo_tie.jpg') as number;
const DRINK = BRAND_SAMPLE[1];

/**
 * The bar's pages as Android's carousel (canvas Theme-and): the page in front
 * large, the next medium, one more peeking; scrolling brings each to the front.
 * Each item is drawn at the large size and masked to the width it shows. A tap
 * opens that page full size.
 */
export function ThemeCarousel({ look, scheme, onOpen }: { look: BrandLook; scheme: BackbarScheme; onOpen: (kind: MiniKind) => void }) {
  const { width } = useWindowDimensions();
  const x = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => x.set(e.contentOffset.x));
  return (
    <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={16} snapToInterval={STEP} decelerationRate="fast" style={styles.strip}>
      {/* Long enough to scroll the last page to the front; the strip starts a gutter in. */}
      <View style={{ width: width - space.lg + (ORDER.length - 1) * STEP, height: HEIGHT }}>
        {ORDER.map((kind, i) => (
          <Item key={kind} index={i} x={x} label={`${MINIS.find((m) => m.kind === kind)?.label} at ${look.name}, ${scheme} mode`} onPress={() => onOpen(kind)}>
            <BackbarTheme scheme={kind === 'photo' ? 'dark' : scheme}>
              <BrandProvider accent={look.accent ?? DEFAULT_ACCENT} groundTint={look.groundTint} displayFace={look.displayFace}>
                <Card kind={kind} look={look} />
              </BrandProvider>
            </BackbarTheme>
          </Item>
        ))}
      </View>
    </Animated.ScrollView>
  );
}

function Item({ index, x, label, onPress, children }: { index: number; x: SharedValue<number>; label: string; onPress: () => void; children: ReactNode }) {
  const place = useAnimatedStyle(() => {
    const p = index - x.get() / STEP;
    // Inside the scroll, so it rides along: add the scroll back to hold it to its place.
    return { left: x.get() + interpolate(p, PLACES, LEFT, 'clamp'), width: interpolate(p, PLACES, WIDE, 'clamp') };
  });
  return (
    <Animated.View style={[styles.item, place]}>
      <PressableScale role="button" accessibilityLabel={label} accessibilityHint="Opens it full size" onPress={onPress} style={styles.fill}>
        {children}
      </PressableScale>
    </Animated.View>
  );
}

/** A page as the carousel shows it: what makes it the bar's, at the large size. */
function Card({ kind, look }: { kind: MiniKind; look: BrandLook }) {
  const ds = useDs();
  const accent = look.accent ?? DEFAULT_ACCENT;
  const rank = (
    <View style={[styles.button, { backgroundColor: ds.accentFill.fill }]}>
      <DsText variant="label" color={ds.accentFill.text} style={styles.medium}>Rank it</DsText>
    </View>
  );
  return (
    <View style={[styles.card, { backgroundColor: kind === 'drawn' ? ds.c.paper : ds.c.ground }]}>
      {kind === 'bar' ? <LinearGradient colors={[withAlpha(accent, ds.scheme === 'dark' ? 0.32 : 0.26), withAlpha(accent, 0.06)]} style={StyleSheet.absoluteFill} /> : null}
      {kind === 'photo' ? (
        <>
          <Image source={PHOTO} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
          <LinearGradient colors={[withAlpha(ds.c.ground, 0), ds.c.ground]} locations={[0.4, 0.95]} style={StyleSheet.absoluteFill} />
        </>
      ) : null}
      {kind === 'drawn' ? (
        <View style={styles.drawing}>
          <DrinkImage sketch={DRINK.sketch} itemId={DRINK.name} accessibilityLabel={DRINK.name} sketchDetail="thumb" radius={0} />
        </View>
      ) : null}
      {kind === 'bar' ? (
        <View style={styles.logo}>
          <VenueMark venue={{ ...look, roleLevel: 40 }} size={48} />
        </View>
      ) : null}
      <View style={styles.foot}>
        {kind === 'bar' ? (
          <DsText variant="headline" numberOfLines={1} style={nameStyle(ds.displayFace, type.headline)}>{look.shortName.trim() || look.name}</DsText>
        ) : (
          <DsText variant="title" numberOfLines={1} style={nameStyle(ds.displayFace, type.title)}>{kind === 'menu' ? 'Autumn' : DRINK.name}</DsText>
        )}
        {kind === 'drawn' || kind === 'photo' ? rank : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexGrow: 0, marginLeft: space.lg },
  item: { position: 'absolute', top: 0, height: HEIGHT, borderRadius: radius.card + space.xs + 2, borderCurve: 'continuous', overflow: 'hidden' },
  fill: { flex: 1 },
  card: { width: LARGE, height: HEIGHT },
  drawing: { position: 'absolute', top: space.xl - 2, left: (LARGE - MEDIUM) / 2, width: MEDIUM, height: MEDIUM },
  logo: { position: 'absolute', top: space.xl + space.sm - 2, left: space.lg + 2 },
  foot: { position: 'absolute', left: space.lg + 2, right: space.lg + 2, bottom: space.lg + 2, gap: space.sm },
  button: { alignSelf: 'flex-start', height: 32, paddingHorizontal: space.lg, justifyContent: 'center', borderRadius: radius.pill },
  medium: { ...font.medium },
});
