import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useLogoEdge } from '@/lib/logoEdge';

/** An opaque logo sits in this share of its tile, as the home-screen icon does (venue-app). */
const INSET = 0.8;

export interface LogoImageProps {
  uri: string;
  size: number;
  /** The tile's corner: size / 2 for a round mark. */
  radius: number;
  /** A colour to set an opaque logo on instead of its own edge colour (the venue's home-screen icon background). */
  fill?: string | null;
  /** Behind a transparent logo, or one whose edge isn't known, as each place drew it before (a pin's white disc). */
  clearBackground?: string;
  /** A border and the like for the tile. */
  style?: StyleProp<ViewStyle>;
  onLoad?: (size: { width: number; height: number }) => void;
  /** Read out as an image ("Little Rye logo"); without it the logo is hidden from screen readers, as a mark beside a name. */
  label?: string;
}

/**
 * A venue or bar logo cut to its mark's shape without a ring of its own
 * background. A logo on a flat colour (most JPEGs, a PNG with a white square)
 * sits inside a tile of that colour, so the edge blends instead of a halo
 * showing where the shape cuts it. A transparent logo, a photo, or one whose
 * edge isn't known (an untagged logo on a phone) fills the tile as before; a
 * transparent one is fitted inside it, never cropped.
 * On the web an untagged logo's edge is read first (lib/logoEdge), so it never
 * jumps from one look to the other.
 */
export function LogoImage({ uri, size, radius, fill, clearBackground, style, onLoad, label }: LogoImageProps) {
  const edge = useLogoEdge(uri);
  const box = { width: size, height: size, borderRadius: radius };
  const a11y = label ? ({ role: 'img', 'aria-label': label } as const) : ({ 'aria-hidden': true } as const);
  const loaded = onLoad ? (e: { source: { width: number; height: number } }) => onLoad({ width: e.source.width, height: e.source.height }) : undefined;
  if (edge === undefined) return <View style={[box, style]} {...a11y} />;
  if (edge?.kind === 'solid') {
    const inner = Math.round(size * INSET);
    return (
      <View style={[box, styles.tile, { backgroundColor: fill ?? edge.color }, style]} {...a11y}>
        <Image source={{ uri }} style={{ width: inner, height: inner }} contentFit="contain" cachePolicy="memory-disk" recyclingKey={uri} accessibilityIgnoresInvertColors onLoad={loaded} />
      </View>
    );
  }
  return (
    <View style={[box, styles.tile, edge?.kind !== 'busy' && clearBackground ? { backgroundColor: clearBackground } : null, style]} {...a11y}>
      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit={edge?.kind === 'clear' ? 'contain' : 'cover'} cachePolicy="memory-disk" recyclingKey={uri} accessibilityIgnoresInvertColors onLoad={loaded} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
});
