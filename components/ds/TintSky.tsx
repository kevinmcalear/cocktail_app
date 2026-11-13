import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { withAlpha } from '@/lib/color';

import { useDs } from './theme';

/** How far down the sky reaches before it is the page's ground. */
const SKY = 440;

/**
 * The sky over the top of a page (the boards' skyOf): paint colours left to
 * right, fading into the ground. Tonight passes its hero drinks' colours;
 * first run's Welcome passes the ones it carries.
 * `cap`: its top edge only, unfaded, for ScrollSky's pull.
 */
export function TintSky({ tints, cap }: { tints: readonly string[]; cap?: boolean }) {
  const ds = useDs();
  if (!tints.length) return null;
  const strength = ds.scheme === 'dark' ? 0.22 : 0.16;
  const colors = (tints.length === 1 ? [tints[0], tints[0]] : tints).map((t) => withAlpha(t, strength)) as [string, string, ...string[]];
  return (
    <View pointerEvents="none" style={[styles.sky, cap && { backgroundColor: ds.c.ground }]}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      {cap ? null : <LinearGradient colors={[withAlpha(ds.c.ground, 0), ds.c.ground]} style={StyleSheet.absoluteFill} />}
    </View>
  );
}

const styles = StyleSheet.create({
  sky: { position: 'absolute', left: 0, right: 0, top: 0, height: SKY },
});
