import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { createContext, use, useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { DsText, GlassButton, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { material } from '@/constants/material';
import { displayFaces, displayName, font, radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import { itemTones, photoTones, type Tones } from '@/lib/tones';

import { DOCKED } from './DrawingHero';
import type { Controls } from './ItemHeader';

/** Where the bar's glyph lands beside Back (And-page: 36 dp at 56, centred in the bar). */
export const MATERIAL_DOCK = { left: material.barInset + material.iconButton + material.barInset, top: (material.bar - DOCKED) / 2 };
/** Where the name lands, after the glyph. */
const TITLE_LEFT = MATERIAL_DOCK.left + DOCKED + space.md;
/** Where a photo page's name sits, with no glyph (And-photo). */
const PHOTO_TITLE_LEFT = material.barInset + material.iconButton + space.sm;
const TITLE_SCALE = displayName.row.fontSize / displayName.page.fontSize;
/** "Edit" with its pencil, its padding and the gap after it. */
const EDIT_WIDTH = 92;

/** The fill comes in as the body nears the bar: on And-page (hero 350) that is 200 to 280. */
const FILL_EARLY = 50;
const FILL_LATE = 30;
/** The name's ride (And-scroll-glide: 90 to 290, eased). */
const rideAt = (y: number) => {
  'worklet';
  const p = Math.min(1, Math.max(0, (y - 90) / 200));
  return p * p * (3 - 2 * p);
};

interface GlideFrom {
  scrollY: SharedValue<number>;
  /** Where the name block starts, down and across the page. */
  top: number;
  left: number;
  width: number;
}

interface NameBox {
  /** The name's top inside the block, under the eyebrow. */
  top: number | null;
  lines: number;
  /** The widest line. */
  width: number;
}

interface Glide extends GlideFrom {
  box: NameBox;
  ready: boolean;
  setTop: (top: number) => void;
  setLines: (lines: number, width: number) => void;
}

interface PageContext {
  tones: Tones;
  /** The page has this bar, so More goes plain. */
  bar: boolean;
  glide: Glide | null;
}

const Page = createContext<PageContext | null>(null);
/** The 40 dp circles behind the bar's icons, on a photo. */
const Circle = createContext<{ color: string; fade: ReturnType<typeof useAnimatedStyle> } | null>(null);

/** Android's drink and item page: the drink's tones for every control under it, and the name's ride into the bar. */
export function MaterialPage({ liquid, photo, bar, glide, children }: { liquid: string | null; photo: boolean; bar: boolean; glide: GlideFrom | null; children: ReactNode }) {
  const ds = useDs();
  const [box, setBox] = useState<NameBox>({ top: null, lines: 0, width: 0 });
  const tones = useMemo(() => (photo ? photoTones(ds.scheme) : itemTones(liquid, ds.accentFill.fill, ds.scheme)), [photo, liquid, ds.accentFill.fill, ds.scheme]);
  const value = useMemo<PageContext>(
    () => ({
      tones,
      bar,
      glide: glide && {
        ...glide,
        box,
        ready: box.top !== null && box.lines > 0,
        setTop: (top) => setBox((b) => (b.top === top ? b : { ...b, top })),
        setLines: (lines, width) => setBox((b) => (b.lines === lines && b.width === width ? b : { ...b, lines, width })),
      },
    }),
    [tones, bar, glide?.scrollY, glide?.top, glide?.left, glide?.width, box], // eslint-disable-line react-hooks/exhaustive-deps -- glide is rebuilt each render; by value.
  );
  return <Page value={value}>{children}</Page>;
}

export const useTitleGlide = () => use(Page)?.glide ?? null;

/** The page's tones. Outside a page (the gallery, a sheet): built from the accent. */
export function useItemTones(): Tones {
  const ds = useDs();
  const page = use(Page);
  return useMemo(() => page?.tones ?? itemTones(null, ds.accentFill.fill, ds.scheme), [page?.tones, ds.accentFill.fill, ds.scheme]);
}

/** Material's segmented list: one tile per row, rounded at the group's ends (And-item-*-staff). */
export function useTile() {
  const { tile } = useItemTones();
  return (index: number, count: number) => {
    const top = index === 0 ? material.tile.end : material.tile.seam;
    const bottom = index === count - 1 ? material.tile.end : material.tile.seam;
    return { backgroundColor: tile, minHeight: material.tile.height, overflow: 'hidden' as const, borderTopLeftRadius: top, borderTopRightRadius: top, borderBottomLeftRadius: bottom, borderBottomRightRadius: bottom };
  };
}

interface MaterialBarProps {
  name: string;
  /** The status bar's height. */
  top: number;
  photo: boolean;
  /** The hero's height. */
  hero: number;
  /** The page's own width (a pane can be narrower than the window). */
  width: number;
  scrollY: SharedValue<number>;
  /** Where the small name starts when the big one is in the photo and leaves sooner. */
  smallAt?: number;
  noBack?: boolean;
  controls: Controls;
  /** The drawing on its way into the bar. */
  drawing: ReactNode;
}

/**
 * Android's top app bar on drink and item pages (boards And-page, And-photo,
 * And-scroll-glide-*): 64 dp, plain icon Back and Share, a tonal Edit. On a
 * drawing's page the bar stays clear while the drawing and the name fold into
 * it, then fills. On a photo the icons sit in 40 dp tonal circles until the
 * bar fills, and the small name fades in.
 *
 * ponytail: drawn in React Native, not the system's, because @expo/ui has no
 * flexible top app bar yet (And-kit-hybrid, Kevin's pick). Swap to Compose's
 * when @expo/ui ships one.
 */
export function MaterialBar({ name, top, photo, hero, width, scrollY, smallAt, noBack, controls, drawing }: MaterialBarProps) {
  const ds = useDs();
  const router = useRouter();
  const tones = useItemTones();
  const { save, onShare, onEdit, editLabel = 'Edit', more } = controls;
  const room = [save, onShare, more].filter(Boolean).length * material.iconButton + (onEdit ? EDIT_WIDTH : 0) + material.barInset;
  // A photo page fills when its first line reaches the bar: the body rides up over the hero by space.xxl.
  const tuck = hero - space.xxl - top - material.bar;
  // A drawing's page fills as its body nears the bar, whatever the drawing's size.
  const under = hero - top - material.bar;
  const fillAt = photo ? [tuck, tuck + 80] : [under - FILL_EARLY, under + FILL_LATE];
  const fill = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.get(), fillAt, [0, 1], 'clamp') }));
  const circleFade = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.get(), fillAt, [1, 0], 'clamp') }));
  const circle = tones.circle ? { color: tones.circle, fade: circleFade } : null;
  const smallTop = top + (material.bar - displayName.row.lineHeight) / 2;
  return (
    <>
      {/* The page decides light or dark, a photo's page too: the status bar follows it, not the phone. */}
      <StatusBar style={ds.scheme === 'dark' ? 'light' : 'dark'} />
      <Animated.View style={[styles.fill, { height: top + material.bar, backgroundColor: tones.bar }, fill]} />
      {drawing}
      {photo ? <PhotoTitle name={name} top={smallTop} width={width - PHOTO_TITLE_LEFT - room} tuck={smallAt ?? tuck} scrollY={scrollY} /> : <GlideTitle name={name} top={top} smallTop={smallTop} room={width - TITLE_LEFT - room} />}
      <View style={[styles.row, { top }]}>
        <Circle value={circle}>
          {noBack ? <View /> : <BarIcon label="Back" icon="arrow.left" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />}
          <View style={styles.tools}>
            {save ? <BarIcon label={save.label[save.saved ? 1 : 0]} icon={save.icon === 'heart' ? (save.saved ? 'heart.fill' : 'heart') : save.saved ? 'bookmark.fill' : 'bookmark'} onPress={save.onToggle} /> : null}
            {onEdit ? (
              <PressableScale accessibilityLabel={editLabel} onPress={onEdit} style={[styles.edit, { backgroundColor: tones.tonal }]}>
                <IconSymbol name="pencil" size={18} color={ds.c.ink} />
                <DsText color={ds.c.ink} style={styles.label}>
                  Edit
                </DsText>
              </PressableScale>
            ) : null}
            {onShare ? <BarIcon label="Share" icon="share.nodes" onPress={onShare} /> : null}
            {more}
          </View>
        </Circle>
      </View>
    </>
  );
}

/** The bar's small name, in the display face. */
function SmallName({ name }: { name: string }) {
  const ds = useDs();
  return (
    <DsText numberOfLines={1} color={ds.c.ink} style={[displayName.row, { fontFamily: displayFaces[ds.displayFace].regular }]}>
      {name}
    </DsText>
  );
}

function GlideTitle({ name, top, smallTop, room }: { name: string; top: number; smallTop: number; room: number }) {
  const glide = useTitleGlide();
  if (!glide?.ready || glide.box.top === null) return null;
  return <Riding name={name} glide={glide} from={glide.top + glide.box.top} landing={top + (material.bar - displayName.page.lineHeight * TITLE_SCALE) / 2} smallTop={smallTop} room={room} fits={glide.box.lines === 1 && glide.box.width * TITLE_SCALE <= room} />;
}

/**
 * The name on its way into the bar: the page's own name scaled down as it
 * rises, so it stays one thing. A name that wrapped, or won't fit beside the
 * tools once small, hands over to the one-line name as it lands.
 */
function Riding({ name, glide, from, landing, smallTop, room, fits }: { name: string; glide: Glide; from: number; landing: number; smallTop: number; room: number; fits: boolean }) {
  const { scrollY, left, width } = glide;
  const big = useAnimatedStyle(() => {
    const y = scrollY.get();
    const g = rideAt(y);
    return {
      opacity: fits ? 1 : interpolate(g, [0.55, 0.85], [1, 0], 'clamp'),
      transform: [{ translateX: interpolate(g, [0, 1], [left, TITLE_LEFT]) }, { translateY: interpolate(g, [0, 1], [from - y, landing]) }, { scale: interpolate(g, [0, 1], [1, TITLE_SCALE]) }],
    };
  });
  const small = useAnimatedStyle(() => ({ opacity: fits ? 0 : interpolate(rideAt(scrollY.get()), [0.7, 1], [0, 1], 'clamp') }));
  return (
    <View style={styles.over} aria-hidden>
      <Animated.View style={[styles.riding, { width }, big]}>
        <DsText variant="display" style={displayName.page}>
          {name}
        </DsText>
      </Animated.View>
      <Animated.View style={[styles.small, { top: smallTop, left: TITLE_LEFT, width: room }, small]}>
        <SmallName name={name} />
      </Animated.View>
    </View>
  );
}

/** On a photo the big name scrolls away with the page and the small one fades in (the phone's way, And-photo). */
function PhotoTitle({ name, top, width, tuck, scrollY }: { name: string; top: number; width: number; tuck: number; scrollY: SharedValue<number> }) {
  const fade = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.get(), [tuck + 40, tuck + 70], [0, 1], 'clamp') }));
  return (
    <Animated.View style={[styles.small, { top, left: PHOTO_TITLE_LEFT, width }, fade]} aria-hidden>
      <SmallName name={name} />
    </Animated.View>
  );
}

interface BarIconProps {
  label: string;
  icon: ComponentProps<typeof IconSymbol>['name'];
  onPress: () => void;
}

/** A plain icon button, with Android's ripple. Over a photo it sits in a 40 dp tonal circle that goes as the bar fills. */
function BarIcon({ label, icon, onPress }: BarIconProps) {
  const ds = useDs();
  const circle = use(Circle);
  return (
    <Pressable role="button" accessibilityLabel={label} onPress={onPress} android_ripple={{ color: withAlpha(ds.c.ink, 0.12), borderless: true, radius: material.iconButton / 2 }} style={styles.icon}>
      {circle ? <Animated.View style={[styles.circle, { backgroundColor: circle.color }, circle.fade]} /> : null}
      <IconSymbol name={icon} size={24} color={ds.c.ink} />
    </Pressable>
  );
}

/** More's button: a plain icon in this bar, the glass one beside a wide page's glass bar. */
export function BarButton(props: ComponentProps<typeof GlassButton>) {
  if (!use(Page)?.bar) return <GlassButton {...props} />;
  return <BarIcon label={props.accessibilityLabel} icon={props.icon ?? 'ellipsis'} onPress={() => props.onPress?.()} />;
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, pointerEvents: 'none' },
  over: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' },
  row: { position: 'absolute', left: material.barInset, right: material.barInset, height: material.bar, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tools: { flexDirection: 'row', alignItems: 'center' },
  icon: { width: material.iconButton, height: material.iconButton, alignItems: 'center', justifyContent: 'center' },
  circle: { position: 'absolute', width: material.control, height: material.control, borderRadius: radius.pill },
  edit: { height: material.control, marginRight: material.barInset, paddingLeft: space.md, paddingRight: space.lg, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  label: { ...material.label, ...font.medium },
  riding: { position: 'absolute', top: 0, left: 0, transformOrigin: 'left top' },
  small: { position: 'absolute', pointerEvents: 'none' },
});
