import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { useDs, type DrawingSize } from '@/components/ds';
import { drawing, menuBandHeight, radius, space } from '@/constants/tokens';
import { useItemSketch } from '@/hooks/useItemSketch';
import { withAlpha } from '@/lib/color';
import { liquidOf } from '@/lib/sketch/types';

import { MenuDrawing, type MenuInk } from './MenuDrawing';

/** A menu's sky: each of its first three drinks' own wash, left to right; `fade` lets it go into the page below (Menu-page, A). */
export function MenuSky({ ids, fade }: { ids: string[]; fade: boolean }) {
  const ds = useDs();
  const a = useItemSketch(ids[0]).data;
  const b = useItemSketch(ids[1]).data;
  const c = useItemSketch(ids[2]).data;
  const alpha = ds.scheme === 'dark' ? 0.3 : 0.24;
  const wash = [a, b, c].filter(Boolean).map((i) => withAlpha(liquidOf(i!).hex, alpha));
  if (!wash.length) return null;
  const colors = (wash.length === 1 ? [wash[0], wash[0]] : wash) as [string, string, ...string[]];
  return (
    <View style={StyleSheet.absoluteFill} aria-hidden>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      {fade ? <LinearGradient colors={[withAlpha(ds.c.ground, 0), ds.c.ground]} style={StyleSheet.absoluteFill} /> : null}
    </View>
  );
}

/**
 * Where a menu's three drawings sit, in points from the group's top left:
 * the middle one larger, higher and in front (Menu-page draws 160, 206, 160;
 * Menu-shelf's card 140, 168, 140).
 */
const TRIO = {
  hero: { x: [0, 88, 222], y: [50, 0, 50], s: [drawing.tile, drawing.middle, drawing.tile] },
  band: { x: [0, 86, 180], y: [20, 0, 20], s: [140, 168, 140] },
} as const;
export type TrioLayout = keyof typeof TRIO;

/** The size each place is drawn at; a smaller place shows that drawing scaled down. */
const DRAWN: readonly DrawingSize[] = ['tile', 'middle', 'tile'];

/** Up to three drawings together, overlapping, the middle of three larger, higher and in front. */
export function MenuTrio({ ids, ink, layout = 'hero', top = 64 }: { ids: string[]; ink: MenuInk; layout?: TrioLayout; top?: number }) {
  const t = TRIO[layout];
  const shown = ids.slice(0, 3);
  // One drink takes the middle place; two take the outer ones, closer together.
  const places = shown.length === 3 ? [0, 1, 2] : shown.length === 2 ? [0, 2] : [1];
  const xs = shown.length === 2 ? [0, t.s[0] * 0.55] : places.map((p) => t.x[p]);
  const ys = places.map((p) => (shown.length === 3 ? t.y[p] : 0));
  const width = Math.max(...places.map((p, i) => xs[i] + t.s[p]));
  const height = Math.max(...places.map((p, i) => ys[i] + t.s[p]));
  return (
    <View style={[styles.trio, { paddingTop: top }]} aria-hidden>
      <View style={{ width, height }}>
        {shown.map((id, i) => {
          const s = t.s[places[i]];
          const size = DRAWN[places[i]];
          const px = drawing[size as 'tile' | 'middle'];
          return (
            <View key={id} style={[styles.place, { left: xs[i], top: ys[i], width: s, height: s, zIndex: places[i] === 1 ? 1 : 0 }]}>
              <View style={s === px ? undefined : { transform: [{ scale: s / px }] }}>
                <MenuDrawing itemId={id} size={size} ink={ink} bare />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** The on-now menu on a list: its drinks drawn together on their sky, in a rounded band (Menu-shelf). */
export function MenuBand({ ids, height = menuBandHeight }: { ids: string[]; height?: number }) {
  return (
    <View style={[styles.band, { height }]}>
      <MenuSky ids={ids} fade={false} />
      <MenuTrio ids={ids} ink="colour" layout="band" top={6} />
    </View>
  );
}

/** A row's strip of drawings, small and overlapping (colour, or pencil for a draft); `wide`: four side by side (the timeline). */
export function MenuStrip({ ids, ink, wide }: { ids: string[]; ink: MenuInk; wide?: boolean }) {
  return (
    <View style={wide ? styles.wide : styles.strip} aria-hidden>
      {ids.slice(0, wide ? 4 : 3).map((id, i) => (
        <View key={id} style={wide ? styles.timeline : { marginLeft: i ? -drawing.row / 2 : 0 }}>
          <View style={wide ? styles.timelineScale : undefined}>
            <MenuDrawing itemId={id} size="row" ink={ink} bare />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  trio: { ...StyleSheet.absoluteFill, alignItems: 'center' },
  place: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  band: { borderRadius: radius.card, overflow: 'hidden', borderCurve: 'continuous' },
  strip: { flexDirection: 'row', width: 96, height: drawing.row, alignItems: 'center', justifyContent: 'center' },
  wide: { flexDirection: 'row', gap: space.xs },
  // Menu-p-timeline draws 58: a touch over the row size, so the row's drawing is scaled up rather than a fifth size added.
  timeline: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center' },
  timelineScale: { transform: [{ scale: 58 / drawing.row }] },
});
