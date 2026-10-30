import { Image, type ImageLoadEventData } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Button, Caption, GlassButton, Title, useDs } from '@/components/ds';
import { GestureRoot } from '@/components/ds/GestureRoot';
import { cropPhoto } from '@/components/drink/drinkImages';
import { space } from '@/constants/tokens';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { showMessage } from '@/lib/dialogs';
import { isPng } from '@/lib/itemImages';
import { coverScale, cropRect, MAX_ZOOM, panLimit, PHOTO_ASPECT, type Size } from '@/lib/photoCrop';

/** How much each zoom button press zooms. */
const STEP = 0.5;

/**
 * Crop a photo the drink already has (Eddie, 29 Oct: "the crop can't be
 * changed"): the photo in the drink's 4:5 frame, dragged to move and pinched
 * (or the zoom buttons) to zoom. Use this crop makes a new copy; the editor
 * saves it with Done, so Cancel or Discard changes loses nothing.
 */
export function CropPhoto({ uri, onClose, onCropped }: { uri: string | null; onClose: () => void; onCropped: (uri: string) => void }) {
  const reduceMotion = useReducedMotion();
  return (
    <Modal visible={!!uri} animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <GestureRoot style={styles.flex}>
        <BackbarTheme scheme="dark">{uri ? <Cropper uri={uri} onClose={onClose} onCropped={onCropped} /> : null}</BackbarTheme>
      </GestureRoot>
    </Modal>
  );
}

function Cropper({ uri, onClose, onCropped }: { uri: string; onClose: () => void; onCropped: (uri: string) => void }) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const [room, setRoom] = useState<Size | null>(null);
  const [photo, setPhoto] = useState<Size | null>(null);
  const [busy, setBusy] = useState(false);
  // The largest 4:5 frame that fits the room.
  const frame = room ? { width: Math.min(room.width, room.height * PHOTO_ASPECT), height: Math.min(room.height, room.width / PHOTO_ASPECT) } : null;
  const base = photo && frame ? coverScale(photo, frame) : 1;
  const shown = photo ? { width: photo.width * base, height: photo.height * base } : null;

  const zoom = useSharedValue(1);
  const startZoom = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const fw = frame?.width ?? 0;
  const fh = frame?.height ?? 0;
  const sw = shown?.width ?? 0;
  const sh = shown?.height ?? 0;

  // Keeps the frame covered: no edge of the photo shows inside it.
  const place = (nx: number, ny: number, z: number) => {
    'worklet';
    const lx = panLimit(sw, fw, z);
    const ly = panLimit(sh, fh, z);
    x.set(Math.min(lx, Math.max(-lx, nx)));
    y.set(Math.min(ly, Math.max(-ly, ny)));
  };

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onStart(() => {
      startX.set(x.get());
      startY.set(y.get());
    })
    .onUpdate((e) => place(startX.get() + e.translationX, startY.get() + e.translationY, zoom.get()));
  const pinch = Gesture.Pinch()
    .onStart(() => startZoom.set(zoom.get()))
    .onUpdate((e) => {
      const z = Math.min(MAX_ZOOM, Math.max(1, startZoom.get() * e.scale));
      zoom.set(z);
      place(x.get(), y.get(), z);
    });
  const zoomBy = (by: number) => {
    const z = Math.min(MAX_ZOOM, Math.max(1, zoom.get() + by));
    zoom.set(z);
    place(x.get(), y.get(), z);
  };

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: zoom.get() }] }));

  const use = async () => {
    if (!photo || !frame) return;
    setBusy(true);
    try {
      onCropped(await cropPhoto(uri, cropRect(photo, frame, { zoom: zoom.get(), x: x.get(), y: y.get() }), isPng(uri)));
    } catch {
      setBusy(false);
      showMessage("Couldn't crop this photo", 'Try again, or remove it and add it again.');
    }
  };

  return (
    <View style={[styles.flex, { backgroundColor: ds.c.ground, paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.md }]}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View style={styles.flex}>
          <Title role="heading">Crop</Title>
          <Caption tone="muted">Drag to move it. Pinch or use the buttons to zoom.</Caption>
        </View>
        <GlassButton accessibilityLabel="Cancel crop" icon="xmark" onPress={onClose} />
      </View>
      <View style={styles.room} onLayout={(e) => setRoom({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
        {frame ? (
          <GestureDetector gesture={Gesture.Simultaneous(pan, pinch)}>
            <View style={[styles.frame, frame, { borderColor: ds.c.ink }]} accessible role="img" accessibilityLabel="The photo as it will be cropped">
              <Animated.View style={[styles.photo, shown ? { width: shown.width, height: shown.height, left: (frame.width - shown.width) / 2, top: (frame.height - shown.height) / 2 } : styles.fill, style]}>
                <Image source={{ uri }} style={styles.fill} contentFit="cover" onLoad={(e: ImageLoadEventData) => setPhoto({ width: e.source.width, height: e.source.height })} />
              </Animated.View>
            </View>
          </GestureDetector>
        ) : null}
      </View>
      <View style={styles.actions}>
        <GlassButton accessibilityLabel="Zoom out" icon="minus.magnifyingglass" onPress={() => zoomBy(-STEP)} />
        <GlassButton accessibilityLabel="Zoom in" icon="plus.magnifyingglass" onPress={() => zoomBy(STEP)} />
        <Button label={busy ? 'Cropping…' : 'Use this crop'} disabled={busy || !photo} onPress={() => void use()} style={styles.flex} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.md },
  room: { flex: 1, alignItems: 'center', justifyContent: 'center', marginHorizontal: space.lg },
  frame: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  photo: { position: 'absolute' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md },
});
