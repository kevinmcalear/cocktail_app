import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { DrinkImage, Tag, useDs } from '@/components/ds';
import { space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import type { MenuPicture } from '@/types/menus';

interface MenuVisualProps {
  name: string;
  coverUrl: string | null;
  coverPosition?: number;
  /** The menu's first drinks, shown side by side when it has no cover. */
  pictures: MenuPicture[];
  height: number;
  /** Fades into the page below (the menu page on phones). */
  fade?: boolean;
}

/**
 * A menu's picture: its own photo, or with none, its first drinks side by
 * side, each its own photo or sketch. Nothing when it has neither.
 */
export function MenuVisual({ name, coverUrl, coverPosition = 50, pictures, height, fade }: MenuVisualProps) {
  const ds = useDs();
  const shown = pictures.slice(0, 4);
  if (!coverUrl && !shown.length) return null;
  const sketched = !coverUrl && shown.some((p) => !p.imageUrl || p.isSketch);
  return (
    <View
      accessible
      role="img"
      accessibilityLabel={coverUrl ? `${name}, cover photo` : `${name}: ${shown.map((p) => p.name).join(', ')}${sketched ? ', sketches' : ''}`}
      style={[styles.frame, { height, backgroundColor: ds.c.paper }]}
    >
      {coverUrl ? (
        <Image source={{ uri: coverUrl }} contentFit="cover" contentPosition={{ top: `${coverPosition}%`, left: '50%' }} style={styles.fill} />
      ) : (
        shown.map((p, i) => (
          <View key={p.id} style={[styles.tile, i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderColor: ds.c.ground }]}>
            <DrinkImage
              source={p.imageUrl}
              generated={p.isSketch}
              itemId={p.id}
              accessibilityLabel={p.name}
              radius={0}
              hideTag
              style={StyleSheet.flatten([styles.fill, { aspectRatio: undefined, height }])}
            />
          </View>
        ))
      )}
      {fade ? <LinearGradient colors={[withAlpha(ds.c.ground, 0.35), withAlpha(ds.c.ground, 0), ds.c.ground]} locations={[0, 0.4, 1]} style={styles.fill} /> : null}
      {sketched ? <Tag label="Sketch" tone="sketch" style={[styles.tag, fade && styles.tagAboveFade]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flexDirection: 'row', overflow: 'hidden' },
  fill: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' },
  tile: { flex: 1 },
  // Bottom left: the editor's cover buttons sit bottom right.
  tag: { position: 'absolute', left: space.sm, bottom: space.sm },
  // Clear of the fade and the page body that overlaps it.
  tagAboveFade: { bottom: space.xxl + space.md, left: space.lg },
});
