import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Button, dragDismissesKeyboard, HidingHeadScroll, sheetIsDialog, SheetScrollView, Title, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { dragShade } from '@/components/ds/sheetDrag';
import { SheetScrollContext, slideAway, useSheetDrag } from '@/components/ds/useSheetDrag';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { space } from '@/constants/tokens';

import { overlayStyles, useOverlayKeys, type DiscoverOverlayProps } from './discoverOverlayParts';

/**
 * A sheet over Discover: the whole screen or a bottom sheet on phones, a card
 * near the top on wide screens (like ⌘K), and never a bottom sheet on the web.
 * It sits inside the screen rather than in a Modal, so a result can open its
 * page on top and coming back finds it as it was. Android back, Escape on the web, and the scrim close it.
 * As a bottom sheet it drags down to close like the app's Sheet (useSheetDrag).
 * A drag on the list puts the keyboard away; as the whole screen, the head
 * also tucks away while the results are read (HidingHeadScroll).
 */
export function DiscoverOverlay({ label, onClose, full, action, head, footer, children }: DiscoverOverlayProps) {
  const ds = useDs();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const bottom = useTabBarInset();
  const wide = useBreakpoint() !== 'phone';
  const page = full && !wide;
  const card = wide || (sheetIsDialog && !page);
  const sheet = !card && !page;
  const { height: windowHeight } = useWindowDimensions();
  const drag = useSharedValue(0);
  const close = (velocity: number) => {
    'worklet';
    slideAway(drag, windowHeight, velocity, (finished) => {
      'worklet';
      if (finished) scheduleOnRN(onClose);
    });
  };
  const { height, pan, scroll } = useSheetDrag({ drag, enabled: sheet, onClose: close });
  const scrimStyle = useAnimatedStyle(() => ({ opacity: dragShade(drag.get(), height.get()) }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: drag.get() }] }));

  useOverlayKeys(onClose);
  const heading = head ?? (
    <View style={overlayStyles.head}>
      <Title role="heading" style={overlayStyles.flex}>
        {label}
      </Title>
      {action ?? <Button label="Done" variant="ghost" onPress={onClose} />}
    </View>
  );

  const frame = card
    ? [overlayStyles.card, !wide && overlayStyles.narrowCard, { borderColor: ds.c.line, backgroundColor: ds.c.ground }]
    : page
      ? [overlayStyles.flex, { paddingTop: insets.top, backgroundColor: ds.c.ground }]
      : [overlayStyles.sheet, { marginTop: insets.top + space.xxxl, borderColor: ds.c.line, backgroundColor: ds.c.surface }];
  return (
    <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={[StyleSheet.absoluteFill, overlayStyles.layer]}>
      {page ? null : (
        <Animated.View style={[StyleSheet.absoluteFill, scrimStyle]}>
          <Pressable accessibilityLabel="Close" onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: ds.c.scrim }]} />
        </Animated.View>
      )}
      {/* Below the screen's edge: what shows when the sheet is pulled up past the top. */}
      {sheet ? <Animated.View style={[overlayStyles.stretch, { backgroundColor: ds.c.surface }, sheetStyle]} /> : null}
      <GestureDetector gesture={pan}>
        <Animated.View role="dialog" aria-modal aria-label={label} style={[frame, sheetStyle]} onLayout={(e) => height.set(e.nativeEvent.layout.height)}>
          {sheet ? <View style={[overlayStyles.grabber, { backgroundColor: ds.c.lineStrong }]} /> : null}
          {page ? (
            <HidingHeadScroll
              head={heading}
              headStyle={{ paddingHorizontal: gutter, paddingTop: space.lg, paddingBottom: space.md }}
              style={overlayStyles.flex}
              contentContainerStyle={[overlayStyles.gap, { paddingHorizontal: gutter, paddingBottom: footer ? space.lg : bottom }]}
            >
              {children}
            </HidingHeadScroll>
          ) : (
            <>
              <View style={[overlayStyles.gap, { paddingHorizontal: gutter, paddingBottom: space.md }]}>{heading}</View>
              <SheetScrollContext value={scroll}>
                <SheetScrollView
                  {...dragDismissesKeyboard}
                  style={card ? overlayStyles.shrink : overlayStyles.flex}
                  contentContainerStyle={[overlayStyles.gap, { paddingHorizontal: gutter, paddingBottom: footer ? space.lg : card ? space.xl : bottom }]}
                >
                  {children}
                </SheetScrollView>
              </SheetScrollContext>
            </>
          )}
          {footer ? <View style={{ paddingHorizontal: gutter, paddingBottom: card ? space.lg : bottom }}>{footer}</View> : null}
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}
