import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { springs } from '@/constants/tokens';

const MAX_SCALE = 4;
const TAP_SCALE = 2;

interface ZoomablePictureProps {
  source: string | number;
  accessibilityLabel: string;
  width: number;
  height: number;
  /** Controlled, so the zoom button and changing page can zoom in and out too. */
  zoomed: boolean;
  onZoomedChange: (zoomed: boolean) => void;
}

/**
 * One picture that zooms: pinch (touch), double tap or double click, and drag
 * to look around once zoomed. The picture can't be dragged off screen.
 * Reanimated springs follow the system's reduced motion setting.
 */
export function ZoomablePicture({ source, accessibilityLabel, width, height, zoomed, onZoomedChange }: ZoomablePictureProps) {
  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const clamp = (value: number, limit: number) => {
    'worklet';
    return Math.min(limit, Math.max(-limit, value));
  };

  // Springs to a scale and keeps the picture's edges on screen.
  const zoomTo = (to: number) => {
    'worklet';
    scale.set(withSpring(to, springs.glide));
    x.set(withSpring(clamp(x.get(), ((to - 1) * width) / 2), springs.glide));
    y.set(withSpring(clamp(y.get(), ((to - 1) * height) / 2), springs.glide));
  };

  // The zoom button, or the viewer moving to another page.
  useEffect(() => {
    if (zoomed === scale.get() > 1) return;
    const to = zoomed ? TAP_SCALE : 1;
    scale.set(withSpring(to, springs.glide));
    if (!zoomed) {
      x.set(withSpring(0, springs.glide));
      y.set(withSpring(0, springs.glide));
    }
  }, [zoomed, scale, x, y]);

  const pinch = Gesture.Pinch()
    .onStart(() => startScale.set(scale.get()))
    .onUpdate((e) => scale.set(Math.min(MAX_SCALE, Math.max(0.8, startScale.get() * e.scale))))
    .onEnd(() => {
      const done = scale.get() < 1.05 ? 1 : scale.get();
      zoomTo(done);
      scheduleOnRN(onZoomedChange, done > 1);
    });

  const pan = Gesture.Pan()
    .enabled(zoomed)
    .averageTouches(true)
    .onStart(() => {
      startX.set(x.get());
      startY.set(y.get());
    })
    .onUpdate((e) => {
      const s = scale.get();
      x.set(clamp(startX.get() + e.translationX, ((s - 1) * width) / 2));
      y.set(clamp(startY.get() + e.translationY, ((s - 1) * height) / 2));
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const next = scale.get() > 1 ? 1 : TAP_SCALE;
      zoomTo(next);
      scheduleOnRN(onZoomedChange, next > 1);
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: scale.get() }],
  }));

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, doubleTap)}>
      <Animated.View style={[styles.frame, { width, height }]} accessible role="img" accessibilityLabel={accessibilityLabel}>
        <Animated.View style={[styles.fill, style]}>
          <Image source={typeof source === 'string' ? { uri: source } : source} style={styles.fill} contentFit="contain" />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  fill: { width: '100%', height: '100%' },
});
