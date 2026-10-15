import { Image as ExpoImage } from 'expo-image';
import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from 'react-native-draggable-flatlist';

import { Caption, DsText, GlassButton, PressableScale, useDs } from '@/components/ds';
import { CutoutOfferHost } from '@/components/drink/CutoutOfferHost';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { useWebImageDrop } from '@/hooks/useWebImageDrop';
import { withAlpha } from '@/lib/color';

export interface ImageItem {
  id?: string;
  url: string;
  isNew?: boolean;
}

interface SortableImageListProps {
  images: ImageItem[];
  onReorder: (images: ImageItem[]) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  onAddUris?: (uris: string[]) => void;
  generateComponent?: ReactNode;
}

const isWeb = Platform.OS === 'web';

/**
 * A drink's photos in order, side by side: Add (and Generate, when given)
 * first, then each photo, held (or dragged on the web) to reorder, with an x
 * to remove it. On the web, images dropped on the row are added.
 */
export function SortableImageList({ images, onReorder, onRemove, onAdd, onAddUris, generateComponent }: SortableImageListProps) {
  const ds = useDs();
  const [dragOver, setDragOver] = useState(false);
  const dropRef = useWebImageDrop(onAddUris, setDragOver);

  const renderItem = ({ item, drag, isActive, getIndex }: RenderItemParams<ImageItem>) => (
    <ScaleDecorator>
      <View style={[styles.tile, { backgroundColor: ds.c.raised }, isActive && { borderColor: ds.accentText, borderWidth: 2, opacity: 0.8 }]}>
        <PressableScale
          role="button"
          accessibilityLabel="Drag to reorder"
          onLongPress={isWeb ? undefined : drag}
          onPressIn={isWeb ? drag : undefined}
          disabled={isActive}
          haptic={false}
          style={[styles.fill, isWeb && styles.grab]}
        >
          <ExpoImage source={{ uri: item.url }} style={styles.fill} contentFit="cover" />
          {item.isNew ? <View style={[styles.newDot, { backgroundColor: ds.accentText }]} /> : null}
        </PressableScale>
        <View style={styles.remove}>
          <GlassButton
            icon="xmark"
            onMedia
            size={28}
            accessibilityLabel="Remove photo"
            onPress={() => {
              const index = getIndex();
              if (index !== undefined) onRemove(index);
            }}
          />
        </View>
      </View>
    </ScaleDecorator>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <DsText variant="label" tone="muted">
          Photos
        </DsText>
        <Caption tone="muted">{isWeb ? 'Drop images or drag to reorder' : 'Long press to reorder'}</Caption>
      </View>

      <View style={[styles.listBox, dragOver && [styles.dropping, { outlineColor: ds.accentText }]]} ref={dropRef}>
        <DraggableFlatList
          data={images}
          style={styles.flex}
          onDragEnd={({ data }) => onReorder(data)}
          keyExtractor={(item, index) => item.id || item.url + index}
          renderItem={renderItem}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          activationDistance={10}
          ListHeaderComponent={
            <View style={[styles.tile, styles.actions, { borderColor: dragOver ? ds.accentText : ds.c.lineStrong }, dragOver && { backgroundColor: withAlpha(ds.accentText, 0.06) }]}>
              <PressableScale role="button" accessibilityLabel="Add photos" onPress={onAdd} style={styles.action}>
                <IconSymbol name="plus" size={18} color={ds.c.muted} />
                <DsText variant="label" tone="muted">
                  {dragOver ? 'Drop' : 'Add'}
                </DsText>
              </PressableScale>
              {generateComponent ? (
                <>
                  <View style={[styles.divider, { backgroundColor: ds.c.line }]} />
                  <View style={styles.action}>{generateComponent}</View>
                </>
              ) : null}
            </View>
          }
        />
      </View>
      {/* The cocktail editors pick with a cut-out offer; it shows from this sheet. */}
      <CutoutOfferHost />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.xs },
  listBox: { flexDirection: 'row', height: 150 },
  // An outline, not a border, so the row doesn't shift while a file is over it.
  dropping: { borderRadius: radius.control, outlineWidth: 1, outlineStyle: 'dashed' },
  flex: { flex: 1 },
  listContent: { gap: space.md, paddingRight: space.lg + space.xs },
  tile: { width: 100, height: 125, marginTop: 12.5, borderRadius: radius.control, borderCurve: 'continuous', overflow: 'hidden' },
  actions: { borderWidth: 1, borderStyle: 'dashed' },
  action: { flex: 1, flexDirection: 'row', gap: space.xs + 2, alignItems: 'center', justifyContent: 'center' },
  divider: { height: StyleSheet.hairlineWidth },
  fill: { width: '100%', height: '100%' },
  grab: { cursor: 'grab' } as object,
  newDot: { position: 'absolute', top: space.sm, left: space.sm, width: space.sm, height: space.sm, borderRadius: radius.pill },
  remove: { position: 'absolute', top: space.xs, right: space.xs },
});
