import { useState, type ReactNode } from 'react';
import { Animated, Keyboard, Platform, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';

import { dragDismissesKeyboard, pulledPast, touchDismissesKeyboard } from './keyboardDrag';
import { useDs } from './theme';

interface Props extends Omit<ScrollViewProps, 'onScroll'> {
  /** The search field and what sits with it. Its own padding comes in `headStyle`. */
  head: ReactNode;
  headStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
}

const scrolled = (e: NativeSyntheticEvent<NativeScrollEvent>) => e.nativeEvent.contentOffset.y;

// Where the drag in progress began. ponytail: one drag at a time, as with keyboardDrag's touches.
let dragFrom: number | null = null;

// iOS's interactive mode keeps the keyboard while the list goes up; the field is leaving, so it goes too.
const readOn =
  Platform.OS === 'ios'
    ? (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (!pulledPast(dragFrom, scrolled(e))) return;
        dragFrom = null;
        Keyboard.dismiss();
      }
    : undefined;

/**
 * Search results under their field (decided 13 Oct): reading down the
 * results slides the head away and fades it, and a small scroll back up
 * brings it straight back, wherever the list is (Material's enterAlways
 * top app bar, iOS's hidesBarsOnSwipe).
 *
 * Every drag on the screen reaches the keyboard: the list's with
 * dragDismissesKeyboard (on iOS a pull down takes the keyboard with the
 * finger, and reading on puts it away with the field it belongs to), the
 * head's with touchDismissesKeyboard. The head floats over the list rather
 * than scrolling in it: iOS scrolls a list to show a field focused inside it,
 * which jumped the results whenever the field was tapped part way down.
 *
 * ponytail: the bounce past the end of a list counts as a scroll back, so the
 * head peeks in by the bounce's depth there; clamp to the content's height
 * if that's ever noticed.
 */
export function HidingHeadScroll({ head, headStyle, children, style, contentContainerStyle, onScrollBeginDrag, onScrollEndDrag, ...props }: Props) {
  const ds = useDs();
  const [y] = useState(() => new Animated.Value(0));
  const [height, setHeight] = useState(1);

  // A pull past the top leaves the head where it is.
  const top = y.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolateLeft: 'clamp' });
  // How much of the head is out of sight: grows as the list goes up, shrinks the moment it comes back.
  const hidden = Animated.diffClamp(top, 0, height);
  const translateY = Animated.multiply(hidden, -1);
  const opacity = hidden.interpolate({ inputRange: [0, height], outputRange: [1, 0] });

  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { y } } }], {
    useNativeDriver: Platform.OS !== 'web',
    listener: readOn,
  });

  return (
    <View style={[styles.frame, style]}>
      <Animated.ScrollView
        {...dragDismissesKeyboard}
        scrollEventThrottle={16}
        onScroll={onScroll}
        onScrollBeginDrag={(e) => {
          dragFrom = scrolled(e);
          onScrollBeginDrag?.(e);
        }}
        onScrollEndDrag={(e) => {
          dragFrom = null;
          onScrollEndDrag?.(e);
        }}
        // The bar's height scrolls with the content, so the first rows start under it.
        scrollIndicatorInsets={{ top: height }}
        contentContainerStyle={[contentContainerStyle, { paddingTop: height }]}
        {...props}
      >
        {children}
      </Animated.ScrollView>
      <Animated.View
        {...touchDismissesKeyboard}
        onLayout={(e) => setHeight(Math.max(1, e.nativeEvent.layout.height))}
        style={[styles.head, { backgroundColor: ds.c.ground }, headStyle, { transform: [{ translateY }] }]}
      >
        {/* Only the field fades: the bar stays solid, so the rows it slides over never show through. */}
        <Animated.View style={{ opacity }}>{head}</Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Clips the head as it slides up, so it never sits over the status bar.
  frame: { flex: 1, overflow: 'hidden' },
  head: { position: 'absolute', top: 0, left: 0, right: 0 },
});
