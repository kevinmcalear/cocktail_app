import { createContext, use, useEffect, useEffectEvent, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { radius, space, springs } from '@/constants/tokens';

import { dragShade, STRETCH } from './sheetDrag';
import { sheetFrame, sheetIsDialog } from './sheetFrame';
import { useDs } from './theme';
import { SheetScrollContext, slideAway, useSheetDrag } from './useSheetDrag';

/** The backdrop fades on its own, about 200 ms, easing out; it never moves with the sheet. */
const FADE_IN = { duration: 200, easing: Easing.out(Easing.cubic) };
const FADE_OUT = { duration: 180, easing: Easing.in(Easing.cubic) };

const CloseContext = createContext<(() => void) | null>(null);

/**
 * Inside a Sheet: close it the way the backdrop does, animating out before
 * onClose. For the sheet's own X and Cancel buttons.
 */
export function useSheetClose(): () => void {
  const close = use(CloseContext);
  if (!close) throw new Error('useSheetClose is for buttons inside a Sheet');
  return close;
}

export interface SheetProps {
  visible: boolean;
  /** After the sheet has gone: a drag down, the backdrop, back or Escape animate it out first. */
  onClose: () => void;
  /** What the sheet is, for screen readers. */
  accessibilityLabel: string;
  children: ReactNode;
  /** The panel's size and padding (maxWidth, maxHeight, padding). */
  style?: StyleProp<ViewStyle>;
  /** On the page's ground colour instead of the raised surface (the drink page's sheets). */
  ground?: boolean;
  /** Under the grabber: the sheet's title row. */
  header?: ReactNode;
  /** Lift the sheet over the keyboard; the offset is KeyboardAvoidingView's keyboardVerticalOffset. */
  keyboard?: boolean;
  keyboardOffset?: number;
  onShow?: () => void;
  /** iOS: once the sheet is fully gone (to open another modal after it). */
  onDismiss?: () => void;
}

/**
 * The app's one sheet. On phones it springs up from the bottom (the glide
 * spring) over a plain dark backdrop that fades in on its own. Drag it down
 * from anywhere to close it (useSheetDrag): put a scrolling body in a
 * SheetScrollView so it hands over to the drag at its top. With Reduce Motion
 * it fades instead.
 * On the web it's a dialog in the middle of the window (sheetFrame), with the
 * same fading backdrop. Every sheet, popup and picker builds on this.
 */
export function Sheet({ visible, onClose, accessibilityLabel, children, style, ground, header, keyboard, keyboardOffset = 0, onShow, onDismiss }: SheetProps) {
  const ds = useDs();
  const reduceMotion = useReducedMotion();
  const slide = !sheetIsDialog && !reduceMotion;
  const { height: windowHeight } = useWindowDimensions();
  // Gone once it has animated out: the Modal stays up until then.
  const [gone, setGone] = useState(!visible);
  if (visible && gone) setGone(false);

  const backdrop = useSharedValue(0);
  const offset = useSharedValue(slide ? windowHeight : 0);
  const opacity = useSharedValue(slide ? 1 : 0);
  // How far it's pulled down from where it sits; leaving slides this off screen.
  const drag = useSharedValue(0);

  // Out (at the finger's speed after a drag), then `then`. Runs on either thread.
  const leave = (then: () => void, velocity = 0) => {
    'worklet';
    const done = (finished?: boolean) => {
      'worklet';
      if (finished) scheduleOnRN(then);
    };
    backdrop.set(withTiming(0, FADE_OUT));
    if (slide) slideAway(drag, windowHeight, velocity, done);
    else opacity.set(withTiming(0, FADE_OUT, done));
  };

  // Ours to close (backdrop, drag, back): out first, then tell the parent.
  const closed = () => {
    setGone(true);
    onClose();
  };
  const dismiss = () => leave(closed);
  const { height, pan, scroll } = useSheetDrag({
    drag,
    enabled: !sheetIsDialog,
    onClose: (velocity) => {
      'worklet';
      leave(closed, velocity);
    },
  });

  useEffect(() => {
    if (!visible || gone) return;
    // Up from wherever the last close left it (off screen).
    offset.set(offset.get() + drag.get());
    drag.set(0);
    backdrop.set(withTiming(1, FADE_IN));
    if (slide) offset.set(withSpring(0, springs.glide));
    else {
      offset.set(0);
      opacity.set(withTiming(1, FADE_IN));
    }
  }, [visible, gone, slide, backdrop, offset, opacity, drag]);

  // The parent closed it (a Save, a Cancel): out, then the Modal goes.
  const hide = useEffectEvent(() => leave(() => setGone(true)));
  useEffect(() => {
    if (!visible && !gone) hide();
  }, [visible, gone]);

  // The backdrop lightens as the sheet is pulled down; it still never moves.
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.get() * dragShade(drag.get(), height.get()) }));
  const panelStyle = useAnimatedStyle(() => ({ opacity: opacity.get(), transform: [{ translateY: offset.get() + drag.get() }] }));

  const placed = [styles.place, sheetFrame.scrim];
  // The caller's own colour and width, if it set them (RN 0.88 types flatten only for animated styles).
  const own = StyleSheet.flatten(style as never) as ViewStyle | null | undefined;
  const fill: ColorValue = own?.backgroundColor ?? (ground ? ds.c.ground : ds.c.surface);
  const panel = (
    <Animated.View
      role="dialog"
      aria-modal
      aria-label={accessibilityLabel}
      accessibilityViewIsModal
      onAccessibilityEscape={dismiss}
      onLayout={(e) => height.set(e.nativeEvent.layout.height)}
      style={[
        styles.panel,
        sheetIsDialog ? styles.dialog : styles.sheet,
        sheetFrame.panel,
        { backgroundColor: fill, borderColor: ds.c.lineStrong },
        style,
        panelStyle,
      ]}
    >
      {sheetIsDialog ? (
        header
      ) : (
        <View style={styles.handle}>
          <View style={[styles.grabber, { backgroundColor: ds.c.lineStrong }]} />
          {header}
        </View>
      )}
      <SheetScrollContext value={scroll}>{children}</SheetScrollContext>
    </Animated.View>
  );

  // Phones: a drag anywhere on the panel moves it. Just below the screen's
  // edge, moving with it, the sheet's colour carries on: what shows when it's pulled up past the top.
  const dragged = sheetIsDialog ? (
    panel
  ) : (
    <>
      <Animated.View style={[styles.stretch, { backgroundColor: fill, maxWidth: own?.maxWidth ?? styles.panel.maxWidth }, panelStyle]} />
      <GestureDetector gesture={pan}>{panel}</GestureDetector>
    </>
  );

  return (
    <Modal visible={visible || !gone} transparent animationType="none" onRequestClose={dismiss} onShow={onShow} onDismiss={onDismiss}>
      {/* Android: gestures in a Modal need their own root. */}
      <GestureHandlerRootView style={styles.flex}>
        <CloseContext value={dismiss}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: ds.c.scrim }, backdropStyle]}>
            <Pressable accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={dismiss} />
          </Animated.View>
          {keyboard ? (
            // Web gets no behaviour: there the dialog sits in the middle anyway.
            <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: 'height' })} keyboardVerticalOffset={keyboardOffset} style={placed}>
              {dragged}
            </KeyboardAvoidingView>
          ) : (
            <View style={placed}>{dragged}</View>
          )}
        </CloseContext>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  place: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', pointerEvents: 'box-none' },
  panel: { width: '100%', maxWidth: 560, overflow: 'hidden' },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderCurve: 'continuous',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  stretch: { position: 'absolute', bottom: -STRETCH, alignSelf: 'center', width: '100%', height: STRETCH },
  dialog: { maxHeight: '86%' },
  handle: { paddingTop: space.sm },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: radius.pill },
});
