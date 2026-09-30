import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Caption, GlassButton, Tag, Title, useDs } from '@/components/ds';
import { space } from '@/constants/tokens';
import { pictureLabel, pictureTag, type ItemPicture } from '@/lib/itemImages';

import { PicturePager } from './PicturePager';
import { ZoomablePicture } from './ZoomablePicture';

/** An item picture, or a bundled image (require) on /dev/drink. */
// Credits are optional: a bundled preview or a menu cover has none.
export type ShownPicture = Omit<ItemPicture, 'url' | 'credit' | 'sourceUrl'> &
  Partial<Pick<ItemPicture, 'credit' | 'sourceUrl'>> & { url: string | number };

interface PictureViewerProps {
  pictures: ShownPicture[];
  /** The drink's name, for the title and every picture's label. */
  name: string;
  open: boolean;
  /** The picture it opens on. Closing returns to the hero as it was, where focus goes back to. */
  startIndex: number;
  onClose: () => void;
}

/**
 * The drink's pictures full screen, on the dark service ground so they read
 * the same in either theme. Swipe (or the arrows on web) between them; pinch,
 * double tap or the zoom button to look closer. On web, react-native-web's
 * Modal keeps focus inside and closes on Escape.
 */
export function PictureViewer({ pictures, name, open, startIndex, onClose }: PictureViewerProps) {
  const reduceMotion = useReducedMotion();
  return (
    <Modal
      visible={open && pictures.length > 0}
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onClose}
      supportedOrientations={['portrait', 'landscape']}
    >
      <GestureHandlerRootView style={styles.flex}>
        <BackbarTheme scheme="dark">
          {open ? <Viewer pictures={pictures} name={name} startIndex={Math.min(startIndex, pictures.length - 1)} onClose={onClose} /> : null}
        </BackbarTheme>
      </GestureHandlerRootView>
    </Modal>
  );
}

function Viewer({ pictures, name, startIndex, onClose }: Omit<PictureViewerProps, 'open'>) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(startIndex);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [zoomed, setZoomed] = useState(false);
  const picture = pictures[index];
  const tag = pictureTag(picture);
  const total = pictures.length;

  const go = (next: number) => {
    setZoomed(false);
    setIndex(next);
  };

  // Arrow keys page through on web; Escape is the Modal's.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      const next = { ArrowLeft: index - 1, ArrowRight: index + 1 }[e.key];
      if (next === undefined) return;
      // The browser would also scroll the pager itself, a second page.
      e.preventDefault();
      if (next >= 0 && next < total) go(next);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  return (
    <View style={[styles.flex, { backgroundColor: ds.c.ground, paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.md }]}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View style={styles.titles}>
          <Title role="heading" numberOfLines={1}>
            {name}
          </Title>
          <View style={styles.meta}>
            {total > 1 ? <Caption tone="muted">{`${index + 1} of ${total}`}</Caption> : null}
            {tag ? <Tag label={tag} tone={picture.isSketch ? 'sketch' : 'warning'} /> : null}
          </View>
        </View>
        <GlassButton
          accessibilityLabel={zoomed ? 'Zoom out' : 'Zoom in'}
          icon={zoomed ? 'minus.magnifyingglass' : 'plus.magnifyingglass'}
          onPress={() => setZoomed(!zoomed)}
        />
        <GlassButton accessibilityLabel="Close photo" icon="xmark" onPress={onClose} />
      </View>
      <View style={styles.flex} onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
        {size.height ? (
          <PicturePager
            count={total}
            index={index}
            onIndexChange={go}
            scrollEnabled={!zoomed}
            renderPage={(i, width) => (
              <ZoomablePicture
                source={pictures[i].url}
                accessibilityLabel={`${name}, ${pictureLabel(pictures[i], i, total).toLowerCase()}`}
                width={width}
                height={size.height}
                zoomed={zoomed && i === index}
                onZoomedChange={setZoomed}
              />
            )}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.sm },
  titles: { flex: 1, gap: space.xs },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
});
