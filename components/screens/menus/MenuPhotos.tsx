import * as Device from 'expo-device';
import { Image } from 'expo-image';
import { useRef, type ComponentRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Button, Caption, GlassButton, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { MAX_MENU_PHOTOS, pickMenuPhotos, takeMenuPhoto, type MenuPhoto } from '@/lib/readMenu';

import { useMenuPhotoDrop } from './useMenuPhotoDrop';

interface MenuPhotosProps {
  photos: MenuPhoto[];
  onChange: (photos: MenuPhoto[]) => void;
  onError: (message: string) => void;
}

/** The pages of a printed menu to read: take, choose or (on web) drop up to four, in order. */
export function MenuPhotos({ photos, onChange, onError }: MenuPhotosProps) {
  const ds = useDs();
  // The simulator has no camera, and launching it there crashes the app.
  const camera = Platform.OS !== 'web' && Device.isDevice;
  const room = MAX_MENU_PHOTOS - photos.length;
  const zone = useRef<ComponentRef<typeof View>>(null);
  const dragging = useMenuPhotoDrop(zone, (more) => onChange([...photos, ...more].slice(0, MAX_MENU_PHOTOS)));
  const add = async (get: () => Promise<MenuPhoto[]>) => {
    try {
      const more = await get();
      if (more.length) onChange([...photos, ...more].slice(0, MAX_MENU_PHOTOS));
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Couldn’t open your photos.');
    }
  };
  return (
    <View ref={zone} style={[styles.wrap, Platform.OS === 'web' && [styles.zone, { borderColor: dragging ? ds.accentText : ds.c.lineStrong }]]}>
      {photos.length ? (
        <View style={styles.pages}>
          {photos.map((photo, i) => (
            <View key={photo.uri} style={[styles.page, { backgroundColor: ds.c.raised }]}>
              <Image source={{ uri: photo.uri }} contentFit="cover" style={styles.fill} accessible accessibilityLabel={`Page ${i + 1} of the menu`} />
              <View style={styles.remove}>
                <GlassButton icon="xmark" accessibilityLabel={`Remove page ${i + 1}`} onPress={() => onChange(photos.filter((p) => p !== photo))} onMedia />
              </View>
            </View>
          ))}
        </View>
      ) : null}
      <Caption tone="muted">{photos.length ? 'The first page becomes the menu’s cover.' : `Up to ${MAX_MENU_PHOTOS} pages, in order${Platform.OS === 'web' ? '. Drop them here or choose them' : ''}. Drinks already in the library get linked; the rest you can bring in.`}</Caption>
      {room > 0 ? (
        <View style={styles.buttons}>
          {camera ? <Button label={photos.length ? 'Take another' : 'Take a photo'} icon="camera.fill" variant="secondary" onPress={() => add(takeMenuPhoto)} /> : null}
          <Button label={photos.length ? 'Add pages' : 'Choose photos'} icon="photo" variant="secondary" onPress={() => add(() => pickMenuPhotos(room))} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  // On web the picker is also where photos can be dropped.
  zone: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: radius.card, padding: space.md, borderCurve: 'continuous' },
  pages: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  // A fixed height, not aspectRatio: in this wrapping row Android laid the tile out at zero size.
  page: { width: 88, height: 117, borderRadius: radius.control, overflow: 'hidden', borderCurve: 'continuous' },
  fill: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  remove: { position: 'absolute', top: space.xs, right: space.xs },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
