import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { radius } from '@/constants/tokens';

import { DsText } from './Text';
import { useDs } from './theme';

/**
 * A small picture of an ingredient for search and picker rows: its photo, or
 * its initial on the house paper until it has one. Decorative: the row's
 * name says what it is.
 */
export function IngredientThumb({ name, url, size = 40 }: { name: string; url?: string | null; size?: number }) {
  const ds = useDs();
  return (
    <View aria-hidden style={[styles.frame, { width: size, height: size, backgroundColor: ds.c.paper }]}>
      {url ? (
        <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      ) : (
        <DsText variant="headline" color={ds.c.sketchInk}>
          {name.trim().charAt(0).toUpperCase()}
        </DsText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: radius.control, borderCurve: 'continuous', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});
