import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Caption, PressableScale, useDs } from '@/components/ds';
import { CustomIcon } from '@/components/ui/CustomIcons';
import { radius, space } from '@/constants/tokens';
import { useWebImageDrop } from '@/hooks/useWebImageDrop';

interface CocktailPhotoPlaceholderProps {
  onPress?: () => void;
  onDropImages?: (uris: string[]) => void;
}

/** Where a drink with no photo yet takes one: tap to add, or drop a file on the web. */
export function CocktailPhotoPlaceholder({ onPress, onDropImages }: CocktailPhotoPlaceholderProps) {
  const ds = useDs();
  const [dragOver, setDragOver] = useState(false);
  const dropRef = useWebImageDrop(onDropImages, setDragOver);
  const label = dragOver ? 'Drop to add photo' : Platform.OS === 'web' ? 'Drop or tap to add photo' : 'Tap to add photo';

  const content = (
    <View
      ref={dropRef}
      style={[styles.zone, { backgroundColor: dragOver ? ds.c.raised : ds.c.surface, borderColor: dragOver ? ds.accentText : ds.c.lineStrong }]}
    >
      <CustomIcon name="Coupette" size={80} color={ds.c.muted} />
      <Caption tone="muted" align="center">
        {label}
      </Caption>
    </View>
  );

  if (!onPress) return <View style={styles.fill}>{content}</View>;
  return (
    <PressableScale accessibilityLabel="Add photo" onPress={onPress} style={styles.fill}>
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, width: '100%', height: '100%' },
  zone: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.card,
    borderCurve: 'continuous',
  },
});
