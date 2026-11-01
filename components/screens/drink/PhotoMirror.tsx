import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { useDs } from '@/components/ds';
import { withAlpha } from '@/lib/color';

/**
 * Under a photo hero, the page continues the photo (decided 29 Oct,
 * "mirrored extension"): the photo flipped and blurred runs on under the
 * spec, dimmed toward the page's ground so text stays readable.
 */
export function PhotoMirror({ url, top }: { url: string | number; top: number }) {
  const ds = useDs();
  return (
    <View style={[styles.mirror, { top }]} aria-hidden>
      <Image source={typeof url === 'number' ? url : { uri: url }} blurRadius={30} contentFit="cover" style={styles.image} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(ds.c.ground, 0.55) }]} />
      {/* The hero fades to the ground; the mirror eases in from it, so there is no seam. */}
      <LinearGradient colors={[ds.c.ground, withAlpha(ds.c.ground, 0)]} style={styles.ease} />
    </View>
  );
}

const styles = StyleSheet.create({
  mirror: { position: 'absolute', left: 0, right: 0, height: 1500, overflow: 'hidden', pointerEvents: 'none' },
  ease: { position: 'absolute', top: 0, left: 0, right: 0, height: 160 },
  image: { width: '100%', height: '100%', transform: [{ scaleY: -1 }] },
});
