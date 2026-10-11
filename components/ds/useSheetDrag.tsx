import * as Haptics from 'expo-haptics';
import { createContext, use, useEffect, type ComponentProps } from 'react';
import { Keyboard, ScrollView } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useScrollOffset,
  useSharedValue,
  withSpring,
  withTiming,
  type AnimatedRef,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { springs } from '@/constants/tokens';

import { dragCloses, leaveDuration, rubberBand, STRETCH } from './sheetDrag';

/** Closed by a button or the backdrop: away in a short ease-in. */
const SLIDE_OUT = { duration: 220, easing: Easing.in(Easing.cubic) };
/** Closed by a drag: away at the finger's speed, easing out. */
const FLING_OUT = Easing.out(Easing.cubic);

/**
 * Animate a sheet's drag to `to` (off screen), at the finger's speed when it
 * was let go moving down, then `done`.
 */
export function slideAway(drag: SharedValue<number>, to: number, velocity: number, done: (finished?: boolean) => void) {
  'worklet';
  const config = velocity > 0 ? { duration: leaveDuration(to - drag.get(), velocity), easing: FLING_OUT } : SLIDE_OUT;
  drag.set(withTiming(to, config, done));
}

interface SheetScroll {
  native: ReturnType<typeof Gesture.Native>;
  ref: AnimatedRef<Animated.ScrollView>;
  scrollY: SharedValue<number>;
  viewH: SharedValue<number>;
  contentH: SharedValue<number>;
  drag: SharedValue<number>;
}

/** Inside a draggable sheet: lets SheetScrollView hand its top over to the drag. */
export const SheetScrollContext = createContext<SheetScroll | null>(null);

/**
 * The drag that closes a sheet, on the UI thread. Pull anywhere on the panel:
 * down follows the finger and a long pull or a flick closes it; up gives a
 * little (a rubber band) unless the content scrolls. Content in a
 * SheetScrollView scrolls first and hands over to the drag at its top.
 * `drag` is how far it's pulled down (the caller adds it to the panel's
 * translateY). `onClose(velocity)` is a worklet: animate out (slideAway) and
 * tell the parent.
 */
export function useSheetDrag({ drag, enabled, onClose }: { drag: SharedValue<number>; enabled: boolean; onClose: (velocity: number) => void }) {
  const height = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const viewH = useSharedValue(0);
  const contentH = useSharedValue(0);
  // Where the finger was when the sheet started following it.
  const anchor = useSharedValue(0);
  const moved = useSharedValue(false);
  const ref = useAnimatedRef<Animated.ScrollView>();

  const dropKeyboard = () => Keyboard.dismiss();
  const tick = () => void Haptics.selectionAsync();

  // ponytail: the legacy builder API, like the app's other gestures; move them all to gesture-handler 3's hooks together.
  const native = Gesture.Native();
  const pan = Gesture.Pan()
    .withTestId('sheet-drag')
    .enabled(enabled)
    .activeOffsetY([-6, 6])
    .failOffsetX([-12, 12])
    .simultaneousWithExternalGesture(native)
    .onStart((e) => {
      anchor.set(e.translationY);
      moved.set(false);
    })
    .onUpdate((e) => {
      // The content is scrolled down: it scrolls, and the sheet takes over from wherever it reaches its top.
      if (drag.get() <= 0 && scrollY.get() > 0) {
        anchor.set(e.translationY);
        return;
      }
      const d = e.translationY - anchor.get();
      if (d >= 0) {
        if (d > 0 && !moved.get()) {
          moved.set(true);
          scheduleOnRN(dropKeyboard);
        }
        drag.set(d);
      } else drag.set(contentH.get() > viewH.get() ? 0 : -rubberBand(-d, STRETCH));
    })
    .onEnd((e, success) => {
      const d = drag.get();
      if (success && dragCloses(d, e.velocityY, height.get())) {
        scheduleOnRN(tick);
        onClose(e.velocityY);
      } else if (d !== 0) drag.set(withSpring(0, { ...springs.glide, velocity: success ? e.velocityY : 0 }));
    });

  const scroll: SheetScroll | null = enabled ? { native, ref, scrollY, viewH, contentH, drag } : null;
  return { height, pan, scroll };
}

/**
 * A sheet's scrolling body. Scrolls like a ScrollView, and at its top a pull
 * down moves the sheet instead (no bounce there). Anywhere else, a ScrollView.
 * A FlatList inside a sheet uses it too: `renderScrollComponent={(p) => <SheetScrollView {...p} />}`.
 * ponytail: one per sheet (they'd share the sheet's ref); a second one is a plain scroller's job.
 */
export function SheetScrollView(props: ComponentProps<typeof ScrollView>) {
  const sheet = use(SheetScrollContext);
  return sheet ? <DragScroll sheet={sheet} {...props} /> : <ScrollView {...props} />;
}

function DragScroll({ sheet, ref: outer, onLayout, onContentSizeChange, ...props }: ComponentProps<typeof ScrollView> & { sheet: SheetScroll }) {
  const { native, ref, scrollY, viewH, contentH, drag } = sheet;
  // Tracked natively, so a caller's own onScroll (a FlatList's) still works.
  useScrollOffset(ref, scrollY);
  // A fresh body (the sheet opened again) starts at its top.
  useEffect(() => scrollY.set(0), [scrollY]);
  // While the sheet follows the finger, the content holds still at its top.
  useAnimatedReaction(
    () => (drag.get() > 0 ? scrollY.get() : 0),
    (y) => {
      if (y > 0) scrollTo(ref, 0, 0, false);
    },
  );
  return (
    <GestureDetector gesture={native}>
      <Animated.ScrollView
        {...props}
        // A FlatList passes its own ref: both get the scroll view.
        ref={
          outer
            ? (node: Animated.ScrollView | null) => {
                setRef(ref, node);
                setRef(outer, node);
              }
            : ref
        }
        scrollEventThrottle={16}
        bounces={false}
        overScrollMode="never"
        onLayout={(e) => {
          viewH.set(e.nativeEvent.layout.height);
          onLayout?.(e);
        }}
        onContentSizeChange={(w, h) => {
          contentH.set(h);
          onContentSizeChange?.(w, h);
        }}
      />
    </GestureDetector>
  );
}

function setRef(ref: unknown, node: unknown) {
  if (typeof ref === 'function') ref(node);
  else if (ref && typeof ref === 'object') (ref as { current: unknown }).current = node;
}
