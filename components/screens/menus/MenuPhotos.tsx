import * as Device from 'expo-device';
import { Image } from 'expo-image';
import { useRef, type ComponentRef } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import { Caption, GlassButton, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import { MAX_MENU_PHOTOS, pickMenuPhotos, takeMenuPhoto, type MenuPhoto } from '@/lib/readMenu';

import { useMenuPhotoDrop } from './useMenuPhotoDrop';

interface MenuPhotosProps {
  photos: MenuPhoto[];
  onChange: (photos: MenuPhoto[]) => void;
  onError: (message: string) => void;
}

// The simulator has no camera, and launching it there crashes the app.
const CAMERA = Platform.OS !== 'web' && Device.isDevice;

/**
 * Adds pages: `snap` takes one with the camera where there is one (Snap the
 * menu), `ask` offers the camera or the library on a phone, and anywhere
 * else it opens the photo picker.
 */
export function useAddMenuPhotos({ photos, onChange, onError }: MenuPhotosProps) {
  const add = async (get: () => Promise<MenuPhoto[]>) => {
    try {
      const more = await get();
      if (more.length) onChange([...photos, ...more].slice(0, MAX_MENU_PHOTOS));
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Couldn’t open your photos.');
    }
  };
  const pick = () => add(() => pickMenuPhotos(MAX_MENU_PHOTOS - photos.length));
  return (how: 'snap' | 'ask') => {
    if (!CAMERA) return pick();
    if (how === 'snap') return add(takeMenuPhoto);
    Alert.alert('Add a page', undefined, [
      { text: 'Take a photo', onPress: () => void add(takeMenuPhoto) },
      { text: 'Choose photos', onPress: () => void pick() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };
}

/**
 * The pages of a printed menu to read, in order, on paper (venue-menus-new
 * P5): each page, then a dashed "+ Page" while there's room for more. On the
 * web the panel is also where photos can be dropped. `small`: a strip of
 * thumbnails (New menu on a wide screen, whose preview shows the page).
 */
export function MenuPhotos({ photos, onChange, onError, small }: MenuPhotosProps & { small?: boolean }) {
  const ds = useDs();
  const addPhotos = useAddMenuPhotos({ photos, onChange, onError });
  const zone = useRef<ComponentRef<typeof View>>(null);
  const dragging = useMenuPhotoDrop(zone, (more) => onChange([...photos, ...more].slice(0, MAX_MENU_PHOTOS)));
  const ink = ds.c.sketchInk;
  return (
    <View ref={zone} style={[small ? styles.strip : [styles.desk, { backgroundColor: ds.c.paper }], dragging && { borderColor: ds.accentText }]}>
      {photos.map((photo, i) => (
        <View key={photo.uri} style={[small ? styles.thumb : styles.page, { backgroundColor: ds.c.surface }]}>
          <Image source={{ uri: photo.uri }} contentFit="cover" style={styles.fill} accessible accessibilityLabel={`Page ${i + 1} of the menu`} />
          <View style={small ? styles.removeSmall : styles.remove}>
            <GlassButton icon="xmark" accessibilityLabel={`Remove page ${i + 1}`} onPress={() => onChange(photos.filter((p) => p !== photo))} onMedia />
          </View>
        </View>
      ))}
      {photos.length < MAX_MENU_PHOTOS ? (
        <PressableScale role="button" accessibilityLabel="Add a page" onPress={() => addPhotos('ask')} style={[styles.add, small ? styles.addStrip : photos.length ? styles.addNarrow : styles.addWide, { borderColor: small ? ds.c.lineStrong : withAlpha(ink, 0.4) }]}>
          <IconSymbol name="plus" size={18} color={small ? ds.c.ink : ink} />
          <Caption color={small ? ds.c.ink : ink} align="center">
            {small ? 'Add a page' : photos.length ? 'Page' : Platform.OS === 'web' ? 'Add a page, or drop it here' : 'Add a page'}
          </Caption>
          {small && Platform.OS === 'web' ? <Caption tone="muted">or drop it anywhere</Caption> : null}
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  desk: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: space.md, minHeight: 230, padding: space.md, borderRadius: radius.card, borderWidth: 1.5, borderColor: 'transparent', borderCurve: 'continuous' },
  // A fixed height, not aspectRatio: in this row Android laid the tile out at zero size.
  page: { width: 118, height: 160, borderRadius: radius.mark, overflow: 'hidden' },
  fill: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  remove: { position: 'absolute', top: space.xs, right: space.xs },
  add: { height: 160, borderRadius: radius.control, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: space.xs, paddingHorizontal: space.sm },
  addNarrow: { width: 64 },
  addWide: { width: 180 },
  strip: { flexDirection: 'row', alignItems: 'stretch', gap: space.sm, borderRadius: radius.control + 2, borderWidth: 1.5, borderColor: 'transparent' },
  thumb: { width: 56, height: 74, borderRadius: radius.mark, overflow: 'hidden' },
  removeSmall: { position: 'absolute', top: 0, right: 0, transform: [{ scale: 0.7 }] },
  addStrip: { flex: 1, height: 74, gap: 0 },
});
