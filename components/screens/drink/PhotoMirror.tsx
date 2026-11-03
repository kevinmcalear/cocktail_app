import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useDs } from '@/components/ds';
import { withAlpha } from '@/lib/color';
import { markNoCopy, thumbToTry } from '@/lib/thumbnails';

/** How far the ground dims the mirror, so text stays readable. */
const DIM = 0.55;

/**
 * Under a photo hero, the page continues the photo (decided 29 Oct,
 * "mirrored extension"): the photo flipped and blurred runs on under the
 * spec, dimmed toward the page's ground so text stays readable. `left`: from
 * the two-column split up it runs sideways from the photo's edge instead
 * (board Desk-photo-side-*), behind the spec column.
 */
export function PhotoMirror({ url, top, left }: { url: string | number; top?: number; left?: number }) {
  const ds = useDs();
  const sideways = left !== undefined;
  // Blurred this far, the 480 list copy looks the same as the original; the original when it has none.
  const [uri, setUri] = useState(() => (typeof url === 'string' ? (thumbToTry(url) ?? url) : null));
  const onError = () => {
    if (typeof url !== 'string' || uri === url) return;
    markNoCopy(url, 'thumb');
    setUri(url);
  };
  return (
    <View style={sideways ? [styles.side, { left }] : [styles.mirror, { top }]} aria-hidden>
      <Image source={uri ? { uri } : url} onError={onError} blurRadius={sideways ? 40 : 30} contentFit="cover" style={sideways ? styles.imageSide : styles.image} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(ds.c.ground, DIM) }]} />
      {/* The hero fades to the ground; the mirror eases in from it, so there is no seam. */}
      {sideways ? null : <LinearGradient colors={[ds.c.ground, withAlpha(ds.c.ground, 0)]} style={styles.ease} />}
    </View>
  );
}

/** The photo's right edge, dimmed as the mirror is, so the two meet with no seam (the board masks it). */
export function PhotoEdge() {
  const ds = useDs();
  return <LinearGradient colors={[withAlpha(ds.c.ground, 0), withAlpha(ds.c.ground, DIM)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.edge} />;
}

const styles = StyleSheet.create({
  mirror: { position: 'absolute', left: 0, right: 0, height: 1500, overflow: 'hidden', pointerEvents: 'none' },
  side: { position: 'absolute', top: 0, bottom: 0, right: 0, overflow: 'hidden', pointerEvents: 'none' },
  imageSide: { width: '100%', height: '100%', transform: [{ scaleX: -1 }] },
  edge: { position: 'absolute', top: 0, bottom: 0, right: 0, width: '14%', pointerEvents: 'none' },
  ease: { position: 'absolute', top: 0, left: 0, right: 0, height: 160 },
  image: { width: '100%', height: '100%', transform: [{ scaleY: -1 }] },
});
