import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { GlassButton } from '@/components/ds';
import { space } from '@/constants/tokens';

interface PicturePagerProps {
  count: number;
  /** The page showing. The pager scrolls to it when it changes from outside. */
  index: number;
  onIndexChange: (index: number) => void;
  renderPage: (index: number, width: number) => ReactNode;
  /** Off while a picture is zoomed, so a pan moves the picture, not the page. */
  scrollEnabled?: boolean;
  /** Previous and next buttons sit this far from the bottom (clear of a fade). */
  arrowsBottom?: number;
}

/**
 * Pictures side by side, one page each: swipe on touch, and previous/next
 * buttons on web, where a mouse can't swipe. Honours reduced motion.
 */
export function PicturePager({ count, index, onIndexChange, renderPage, scrollEnabled = true, arrowsBottom }: PicturePagerProps) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  // The page the scroll position is on, so a change we reported isn't scrolled to again.
  const shown = useRef(index);
  // While we scroll to a page ourselves, the pages passed on the way aren't choices.
  const target = useRef<number | null>(null);

  // A new width (first layout, rotation, resize) puts the page back in view.
  useLayoutEffect(() => {
    if (width) ref.current?.scrollTo({ x: shown.current * width, animated: false });
  }, [width]);

  useEffect(() => {
    if (!width || shown.current === index) return;
    shown.current = index;
    target.current = index;
    ref.current?.scrollTo({ x: index * width, animated: !reduceMotion });
  }, [index, width, reduceMotion]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;
    const x = e.nativeEvent.contentOffset.x;
    const page = Math.min(count - 1, Math.max(0, Math.round(x / width)));
    // Only once it settles on a page: mid-scroll pages would fight a button's scroll.
    if (Math.abs(x - page * width) > 2) return;
    if (target.current !== null) {
      if (page === target.current) target.current = null;
      return;
    }
    if (page === shown.current) return;
    shown.current = page;
    onIndexChange(page);
  };

  const arrows = Platform.OS === 'web' && count > 1;
  return (
    <View style={styles.fill} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width ? (
        <ScrollView
          ref={ref}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEnabled={scrollEnabled && count > 1}
          onScroll={onScroll}
          onMomentumScrollEnd={onScroll}
          onScrollBeginDrag={() => (target.current = null)}
          scrollEventThrottle={32}
          style={styles.fill}
        >
          {Array.from({ length: count }, (_, i) => (
            <View key={i} style={{ width, height: '100%' }}>
              {renderPage(i, width)}
            </View>
          ))}
        </ScrollView>
      ) : null}
      {arrows && index > 0 ? (
        <View style={[styles.arrow, styles.left, arrowsBottom === undefined ? styles.middle : { bottom: arrowsBottom }]}>
          <GlassButton accessibilityLabel="Previous photo" icon="chevron.left" onMedia onPress={() => onIndexChange(index - 1)} />
        </View>
      ) : null}
      {arrows && index < count - 1 ? (
        <View style={[styles.arrow, styles.right, arrowsBottom === undefined ? styles.middle : { bottom: arrowsBottom }]}>
          <GlassButton accessibilityLabel="Next photo" icon="chevron.right" onMedia onPress={() => onIndexChange(index + 1)} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  arrow: { position: 'absolute' },
  left: { left: space.md },
  right: { right: space.md },
  middle: { top: '50%', marginTop: -22 },
});
