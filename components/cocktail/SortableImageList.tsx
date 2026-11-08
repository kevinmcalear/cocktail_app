import { Image as ExpoImage } from 'expo-image';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Caption, DsText, GlassButton, PressableScale, Tag, useDs } from '@/components/ds';
import { DragList, type DragRowState } from '@/components/ds/DragList';
import { DragScrollView } from '@/components/ds/dragScroll';
import { CutoutOfferHost } from '@/components/drink/CutoutOfferHost';
import { canCropPhotos, uploadDrinkPhoto } from '@/components/drink/drinkImages';
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
  /** When the spec changed after it was taken (item_images.outdated_since). A crop keeps it. */
  outdatedSince?: string | null;
}

interface SortableImageListProps {
  images: ImageItem[];
  onReorder: (images: ImageItem[]) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  onAddUris?: (uris: string[]) => void;
}

const isWeb = Platform.OS === 'web';

/**
 * A drink's photos in order, side by side: Add
 * first, then each photo, held (or dragged on the web) to reorder (DragList,
 * across; near an end the row scrolls), with an x
 * to remove it. The first is the main photo, which leads the page and the
 * cards; a star makes another one main, and Crop recrops one (Eddie, 29 Oct).
 * On the web, images dropped on the row are added.
 */
export function SortableImageList({ images, onReorder, onRemove, onAdd, onAddUris }: SortableImageListProps) {
  const ds = useDs();
  const [dragOver, setDragOver] = useState(false);
  const dropRef = useWebImageDrop(onAddUris, setDragOver);
  // The photo being cropped, by its place in the list.
  const [cropping, setCropping] = useState<number | null>(null);
  const crops = canCropPhotos();
  const makeMain = (index: number) => onReorder([images[index], ...images.filter((_, i) => i !== index)]);

  const renderItem = (item: ImageItem, { index, lifted, grip, move }: DragRowState) => {
    const main = index === 0;
    return (
      <View style={[styles.tile, styles.spaced, { backgroundColor: ds.c.raised }, lifted && { borderColor: ds.accentText, borderWidth: 2 }]}>
        {grip(
          <PressableScale
            role="button"
            accessibilityLabel="Drag to reorder"
            accessibilityActions={[{ name: 'moveUp', label: 'Move earlier' }, { name: 'moveDown', label: 'Move later' }]}
            onAccessibilityAction={(e) => move(e.nativeEvent.actionName === 'moveUp' ? -1 : 1)}
            haptic={false}
            style={[styles.fill, isWeb && (lifted ? styles.grabbing : styles.grab)]}
          >
            <ExpoImage source={{ uri: item.url }} style={styles.fill} contentFit="cover" />
            {item.isNew ? <View style={[styles.newDot, { backgroundColor: ds.accentText }]} /> : null}
          </PressableScale>
        )}
        <View style={styles.remove}>
          <GlassButton
            icon="xmark"
            onMedia
            size={28}
            accessibilityLabel={main ? 'Remove main photo' : 'Remove photo'}
            onPress={() => onRemove(index)}
          />
        </View>
        <View style={styles.foot}>
          {main ? <Tag label="Main" tone="accent" style={{ backgroundColor: ds.c.ground }} /> : <GlassButton icon="star" onMedia size={28} accessibilityLabel="Make this the main photo" onPress={() => makeMain(index)} />}
          {crops && !item.credit ? <GlassButton icon="crop" onMedia size={28} accessibilityLabel={main ? 'Crop main photo' : 'Crop photo'} onPress={() => setCropping(index)} /> : null}
        </View>
      </View>
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
        <DragScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.flex} contentContainerStyle={styles.listContent}>
          <View style={[styles.tile, styles.actions, { borderColor: dragOver ? ds.accentText : ds.c.lineStrong }, dragOver && { backgroundColor: withAlpha(ds.accentText, 0.06) }]}>
            <PressableScale role="button" accessibilityLabel="Add photos" onPress={onAdd} style={styles.action}>
              <IconSymbol name="plus" size={18} color={ds.c.muted} />
              <DsText variant="label" tone="muted">
                {dragOver ? 'Drop' : 'Add'}
              </DsText>
            </PressableScale>
          </View>
          <DragList axis="x" card={false} label="Photos" data={images} keyOf={(item) => item.id || item.url} onReorder={onReorder} renderRow={renderItem} />
        </DragScrollView>
      </View>
      <CropPhoto
        uri={cropping === null ? null : (images[cropping]?.url ?? null)}
        onClose={() => setCropping(null)}
        onCropped={async (uri) => {
          // Uploaded now, so editors (and a draft's autosave) only ever keep a storage URL, never the web's data: URL.
          const uploaded = await uploadDrinkPhoto(uri, 'cocktails/crops').catch(() => null);
          if (!uploaded) throw new Error("Couldn't upload the crop.");
          onReorder(images.map((image, i) => (i === cropping ? { id: uploaded.id, url: uploaded.url, outdatedSince: image.outdatedSince } : image)));
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
  fill: { width: '100%', height: '100%' },
  // The photo's the grip: on the web it grabs the mouse; a finger scrolls the row until it holds.
  grab: { cursor: 'grab', touchAction: 'none' } as object,
  grabbing: { cursor: 'grabbing', touchAction: 'none' } as object,
  spaced: { marginRight: space.md },
  newDot: { position: 'absolute', top: space.sm, left: space.sm, width: space.sm, height: space.sm, borderRadius: radius.pill },
  remove: { position: 'absolute', top: space.xs, right: space.xs },
  foot: { position: 'absolute', bottom: space.xs, left: space.xs, right: space.xs, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
