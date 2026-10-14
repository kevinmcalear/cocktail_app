import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Platform, type LayoutChangeEvent } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { useAnimatedStyle, useFrameCallback, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { springs } from '@/constants/tokens';
import { AT_REST, isStill, MAX_FLING, MIN_HIT, NO_SHAKE, screenGravity, stepRoll, stepShake, type Bounds } from '@/lib/eightBallRoll';

import { BALL } from './BallArt';
import { useTilt } from './useTilt';

/** Room left between the ball and the screen's edges. */
const EDGE = 8;
/** Bumps closer together than this buzz once. */
const BUZZ_MS = 90;

const buzz = (hard: boolean) => void Haptics.impactAsync(hard ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);

/**
 * Makes the eight ball a ball (lib/eightBallRoll.ts): tilt the phone and it
 * rolls, drag and fling it (the web's way in), and it bounces off the
 * screen's edges with a squash and a light buzz. Runs on the UI thread and
 * moves views only (no SVG props, see BallArt). With Reduce Motion on it
 * stays put. `kick` jostles it, for a new roll. Shaking it hard while
 * holding it calls `onShake` (stepShake), to ask again.
 *
 * Layout: `screen` goes on the full-screen view, `column` on its child that
 * holds the ball, `slot` on an unmoving wrapper round the ball, so the walls
 * are the screen's edges (inside the safe area) wherever the ball's home is.
 */
export function useRollingBall({ still, insets, onShake }: { still: boolean; insets: { top: number; bottom: number }; onShake: () => void }) {
  const tilt = useTilt();
  const roll = useSharedValue(AT_REST);
  const bounds = useSharedValue<Bounds>({ minX: 0, maxX: 0, minY: 0, maxY: 0 });
  const squashX = useSharedValue(0);
  const squashY = useSharedValue(0);
  const lastBuzz = useSharedValue(0);
  // A ref, not a shared value: the three layout events land together, and a shared value read back on the JS thread can miss the last write.
  const layout = useRef({ width: 0, height: 0, columnX: 0, columnY: 0, slotX: 0, slotY: 0 });
  const drag = useSharedValue({ x: 0, y: 0 });
  const shake = useSharedValue(NO_SHAKE);

  // The walls: the screen's edges inside the safe area, as offsets from the ball's home.
  function place(e: LayoutChangeEvent, part: 'screen' | 'column' | 'slot') {
    const { x, y, width, height } = e.nativeEvent.layout;
    const l = layout.current;
    if (part === 'screen') Object.assign(l, { width, height });
    else if (part === 'column') Object.assign(l, { columnX: x, columnY: y });
    else Object.assign(l, { slotX: x, slotY: y });
    const left = l.columnX + l.slotX;
    const top = l.columnY + l.slotY;
    bounds.set({
      minX: Math.min(0, EDGE - left),
      maxX: Math.max(0, l.width - EDGE - left - BALL),
      minY: Math.min(0, insets.top + EDGE - top),
      maxY: Math.max(0, l.height - insets.bottom - EDGE - top - BALL),
    });
  }

  const frames = useFrameCallback((frame) => {
    'worklet';
    const gravity = tilt ? screenGravity(tilt.get()) : null;
    const now = roll.get();
    if (isStill(now, gravity)) return;
    const { roll: next, hitX, hitY } = stepRoll(now, gravity, bounds.get(), (frame.timeSincePreviousFrame ?? 16) / 1000);
    roll.set(next);
    const hit = Math.max(hitX, hitY);
    if (hit < MIN_HIT) return;
    // Squashed flat against the wall it hit, then a wobbly spring back.
    const amount = Math.min(0.16, hit / 5000);
    const across = hitX >= hitY ? squashX : squashY;
    const along = hitX >= hitY ? squashY : squashX;
    across.set(withSequence(withTiming(-amount, { duration: 50 }), withSpring(0, springs.pour)));
    along.set(withSequence(withTiming(amount * 0.6, { duration: 50 }), withSpring(0, springs.pour)));
    if (Platform.OS !== 'web' && frame.timestamp - lastBuzz.get() > BUZZ_MS) {
      lastBuzz.set(frame.timestamp);
      scheduleOnRN(buzz, hit > 1200);
    }
  }, false);

  useEffect(() => {
    frames.setActive(!still);
  }, [frames, still]);

  const pan = Gesture.Pan()
    .enabled(!still)
    .onBegin(() => {
      drag.set({ x: roll.get().x, y: roll.get().y });
      shake.set(NO_SHAKE);
      roll.set({ ...roll.get(), held: true, vx: 0, vy: 0 });
    })
    .onUpdate((e) => {
      const b = bounds.get();
      const start = drag.get();
      roll.set({
        ...roll.get(),
        x: Math.min(b.maxX, Math.max(b.minX, start.x + e.translationX)),
        y: Math.min(b.maxY, Math.max(b.minY, start.y + e.translationY)),
        vx: e.velocityX,
        vy: e.velocityY,
      });
      const next = stepShake(shake.get(), e.velocityX, e.velocityY);
      shake.set(next.shake);
      if (next.fired) scheduleOnRN(onShake);
    })
    .onFinalize((e) => {
      // Inline on purpose: React Compiler hoists a helper arrow out of the worklet, and the UI thread can't call it.
      roll.set({
        ...roll.get(),
        held: false,
        vx: Math.min(MAX_FLING, Math.max(-MAX_FLING, e.velocityX)),
        vy: Math.min(MAX_FLING, Math.max(-MAX_FLING, e.velocityY)),
      });
    });

  function kick() {
    if (still) return;
    const angle = Math.random() * Math.PI * 2;
    const speed = 500 + Math.random() * 400;
    roll.set({ ...roll.get(), vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed });
  }

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: roll.get().x },
      { translateY: roll.get().y },
      { scaleX: 1 + squashX.get() },
      { scaleY: 1 + squashY.get() },
    ],
  }));

  return {
    roll,
    pan,
    style,
    kick,
    onScreenLayout: (e: LayoutChangeEvent) => place(e, 'screen'),
    onColumnLayout: (e: LayoutChangeEvent) => place(e, 'column'),
    onSlotLayout: (e: LayoutChangeEvent) => place(e, 'slot'),
  };
}
