import { Image as ExpoImage } from 'expo-image';
import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from 'react-native-draggable-flatlist';

import { Caption, DsText, GlassButton, PressableScale, Tag, useDs } from '@/components/ds';
import { CutoutOfferHost } from '@/components/drink/CutoutOfferHost';
import { canCropPhotos } from '@/components/drink/drinkImages';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { useWebImageDrop } from '@/hooks/useWebImageDrop';
import { withAlpha } from '@/lib/color';

import { CropPhoto } from './CropPhoto';

export interface ImageItem {
  id?: string;
  url: string;
  isNew?: boolean;
  /** Who a borrowed photo belongs to (images.credit). A crop would be a new, uncredited copy, so it has none. */
  credit?: string | null;
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
 * to remove it. The first is the main photo, which leads the page and the
 * cards; a star makes another one main, and Crop recrops one (Eddie, 29 Oct).
 * On the web, images dropped on the row are added.
 */
export function SortableImageList({ images, onReorder, onRemove, onAdd, onAddUris, generateComponent }: SortableImageListProps) {
  const ds = useDs();
  const [dragOver, setDragOver] = useState(false);
  const dropRef = useWebImageDrop(onAddUris, setDragOver);
  // The photo being cropped, by its place in the list.
  const [cropping, setCropping] = useState<number | null>(null);
  const crops = canCropPhotos();
  const indexOf = (getIndex: () => number | undefined, then: (index: number) => void) => () => {
    const index = getIndex();
    if (index !== undefined) then(index);
  };
  const makeMain = (index: number) => onReorder([images[index], ...images.filter((_, i) => i !== index)]);

  const renderItem = ({ item, drag, isActive, getIndex }: RenderItemParams<ImageItem>) => {
    const main = getIndex() === 0;
    return (
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
            accessibilityLabel={main ? 'Remove main photo' : 'Remove photo'}
            onPress={indexOf(getIndex, onRemove)}
          />
        </View>
        <View style={styles.foot}>
          {main ? <Tag label="Main" tone="accent" style={{ backgroundColor: ds.c.ground }} /> : <GlassButton icon="star" onMedia size={28} accessibilityLabel="Make this the main photo" onPress={indexOf(getIndex, makeMain)} />}
          {crops && !item.credit ? <GlassButton icon="crop" onMedia size={28} accessibilityLabel={main ? 'Crop main photo' : 'Crop photo'} onPress={indexOf(getIndex, setCropping)} /> : null}
        </View>
      </View>
    </ScaleDecorator>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <DsText variant="label" tone="muted">
          Photos
        </DsText>
        <Caption tone="muted">{isWeb ? 'Drop images or drag to reorder' : 'Hold to reorder'}</Caption>
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
      <CropPhoto
        uri={cropping === null ? null : (images[cropping]?.url ?? null)}
        onClose={() => setCropping(null)}
        onCropped={(url) => {
          onReorder(images.map((image, i) => (i === cropping ? { url, isNew: true } : image)));
          setCropping(null);
        }}
      />
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
  foot: { position: 'absolute', bottom: space.xs, left: space.xs, right: space.xs, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
