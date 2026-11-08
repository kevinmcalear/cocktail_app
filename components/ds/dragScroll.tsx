import { createContext, use, useRef, type ComponentProps } from 'react';
import { ScrollView } from 'react-native';
import Animated, { measure, scrollTo, useAnimatedRef, useFrameCallback, useScrollOffset, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

/** How near its edge a held row starts scrolling the page, and the most it scrolls in a frame. */
const EDGE = 72;
const MAX_STEP = 14;

/** A drag list's scroller, for a held row near its edge (components/ds/DragRow). */
export interface DragScroll {
  /** How far it has scrolled since the row was picked up: the row rides along by this much. */
  delta: SharedValue<number>;
  /** Where it was when the row was picked up. */
  start: SharedValue<number>;
  offset: SharedValue<number>;
  /** The finger's (or mouse's) place on the screen along the scroll, while a row is held. */
  pointer: SharedValue<number>;
  held: SharedValue<boolean>;
  horizontal: boolean;
  /** A row is held: scroll near the edges, and tell `listener` each time it scrolls. */
  begin: (listener: (delta: number) => void) => void;
  end: () => void;
}

const DragScrollContext = createContext<DragScroll | null>(null);

/** The scroller around a drag list, if it's a DragScrollView. */
export const useDragScroll = () => use(DragScrollContext);

/**
 * A ScrollView that a drag list inside it scrolls: hold a row near its top or
 * bottom (its ends, `horizontal`) and it scrolls, faster nearer the edge, with
 * the row riding along under the finger. Otherwise a plain ScrollView. The
 * scrolling runs on the UI thread, a frame at a time, only while a row is held.
 */
export function DragScrollView({ ref: outer, horizontal = false, scrollEventThrottle = 16, ...props }: ComponentProps<typeof ScrollView>) {
  const ref = useAnimatedRef<Animated.ScrollView>();
  // Tracked natively, so a caller's own onScroll still works.
  const offset = useScrollOffset(ref);
  const delta = useSharedValue(0);
  const start = useSharedValue(0);
  const pointer = useSharedValue(0);
  const held = useSharedValue(false);
  const listener = useRef<((delta: number) => void) | null>(null);
  const tell = (d: number) => listener.current?.(d);
  const frame = useFrameCallback(() => {
    if (!held.get()) return;
    const m = measure(ref);
    if (m) {
      const p = pointer.get();
      const lo = horizontal ? m.pageX : m.pageY;
      const hi = lo + (horizontal ? m.width : m.height);
      const into = p < lo + EDGE ? p - lo - EDGE : p > hi - EDGE ? p - hi + EDGE : 0;
      if (into) {
        const next = Math.max(0, offset.get() + (Math.max(-EDGE, Math.min(EDGE, into)) / EDGE) * MAX_STEP);
        scrollTo(ref, horizontal ? next : 0, horizontal ? 0 : next, false);
      }
    }
    const d = offset.get() - start.get();
    if (d !== delta.get()) {
      delta.set(d);
      scheduleOnRN(tell, d);
    }
  }, false);
  const value: DragScroll = {
    delta,
    start,
    offset,
    pointer,
    held,
    horizontal,
    begin: (fn) => {
      listener.current = fn;
      frame.setActive(true);
    },
    end: () => {
      listener.current = null;
      frame.setActive(false);
    },
  };
  return (
    <DragScrollContext value={value}>
      <Animated.ScrollView
        {...props}
        horizontal={horizontal}
        scrollEventThrottle={scrollEventThrottle}
        ref={
          outer
            ? (node: Animated.ScrollView | null) => {
                setRef(ref, node);
                setRef(outer, node);
              }
            : ref
        }
      />
    </DragScrollContext>
  );
}

function setRef(ref: unknown, node: unknown) {
  if (typeof ref === 'function') ref(node);
  else if (ref && typeof ref === 'object') (ref as { current: unknown }).current = node;
}
