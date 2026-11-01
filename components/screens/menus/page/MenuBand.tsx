import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { useDs, type DrawingSize } from '@/components/ds';
import { drawing, radius, space } from '@/constants/tokens';
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

/** Up to three drawings together, overlapping, the middle of three higher and in front. */
export function MenuTrio({ ids, ink, size = 'hero', top = 64 }: { ids: string[]; ink: MenuInk; size?: DrawingSize; top?: number }) {
  const px = size === 'hero' ? drawing.heroStaff : drawing[size];
  const raised = (i: number) => ids.length === 3 && i === 1;
  return (
    <View style={[styles.trio, { paddingTop: top }]} aria-hidden>
      {ids.map((id, i) => (
        <View key={id} style={{ marginHorizontal: -px / 6, zIndex: raised(i) ? 1 : 0, marginTop: raised(i) ? 0 : px / 6 }}>
          <MenuDrawing itemId={id} size={size} ink={ink} bare />
        </View>
      ))}
    </View>
  );
}

/** The on-now menu on a list: its drinks drawn together on their sky, in a rounded band (Menu-shelf). */
export function MenuBand({ ids, height = 190 }: { ids: string[]; height?: number }) {
  return (
    <View style={[styles.band, { height }]}>
      <MenuSky ids={ids} fade={false} />
      <MenuTrio ids={ids} ink="colour" size="tile" top={space.lg} />
    </View>
  );
}

/** A row's strip of drawings, small and overlapping (colour, or pencil for a draft); `wide`: four side by side (the timeline). */
export function MenuStrip({ ids, ink, wide }: { ids: string[]; ink: MenuInk; wide?: boolean }) {
  return (
    <View style={wide ? styles.wide : styles.strip} aria-hidden>
      {ids.slice(0, wide ? 4 : 3).map((id, i) => (
        <View key={id} style={{ marginLeft: i ? (wide ? 0 : -drawing.row / 2) : 0 }}>
          <MenuDrawing itemId={id} size="row" ink={ink} bare />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  trio: { ...StyleSheet.absoluteFill, flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start' },
  band: { borderRadius: radius.card, overflow: 'hidden', borderCurve: 'continuous' },
  strip: { flexDirection: 'row', width: 96, height: drawing.row, alignItems: 'center', justifyContent: 'center' },
  wide: { flexDirection: 'row', gap: space.xs },
});
