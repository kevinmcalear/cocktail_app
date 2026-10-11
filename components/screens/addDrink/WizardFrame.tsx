import { useEffect, useState, type ReactNode } from 'react';
import { BackHandler, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Title, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { WebHead } from '@/components/WebHead';
import { layout, space, springs } from '@/constants/tokens';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';

import { Eyebrow } from './WizardChrome';

/** Where the paper band sits, for the band to lay itself out. */
export interface BandPlace {
  top: number;
  side: number;
  rounded: boolean;
  folded: boolean;
  size?: number;
}

export interface WizardFrameProps {
  testID: string;
  /** The browser tab's title. */
  pageTitle: string;
  /** Inside the desktop workspace: no safe-area padding. */
  embedded?: boolean;
  band: (place: BandPlace) => ReactNode;
  /** Changes with the step, so its body slides in. */
  stepKey: string;
  direction: 1 | -1;
  eyebrow: string;
  title: string;
  intro?: string;
  footer: ReactNode;
  /** Android's back button: true when it stepped back, false to leave. */
  onHardwareBack: () => boolean;
  children: ReactNode;
}

/**
 * The screen every add wizard shares: the paper band with its drawing on
 * top (beside the step on a desktop browser), one step at a time sliding
 * in, and the footer pinned above the keyboard. On a phone the band folds
 * to its controls while typing, so the field and the keyboard both fit.
 */
export function WizardFrame({ testID, pageTitle, embedded, band, stepKey, direction, eyebrow, title, intro, footer, onHardwareBack, children }: WizardFrameProps) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const breakpoint = useBreakpoint();
  // Beside the side nav on wide web the column sits left, next to it, never centred (b07).
  const besideNav = useIsWideWeb() && !embedded;
  const windowHeight = useWindowDimensions().height;
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => sub.remove();
  });

  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () => setTyping(true));
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setTyping(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // A phone gets the paper band edge to edge; wider screens and the workspace a centred column.
  const column = breakpoint !== 'phone' || !!embedded;
  const sideBySide = breakpoint === 'desktop' && !embedded;
  // On iOS the screen is a page sheet that starts below the status bar. Its gap
  // to the window's top is both the inset it doesn't need and what
  // KeyboardAvoidingView (which assumes it starts at the top) must add.
  const sheetGap = Platform.OS === 'ios' && !embedded && height ? Math.max(0, windowHeight - height) : 0;
  const statusBar = sheetGap > 0 ? 0 : insets.top;
  const side = column ? 0 : gutter;
  const bottom = embedded ? space.lg : Math.max(insets.bottom, space.lg);

  return (
    <KeyboardAvoidingView
      // Android draws edge to edge, so the window doesn't shrink for the keyboard: the screen does.
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={sheetGap}
      testID={testID}
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
      style={[styles.screen, { backgroundColor: ds.c.ground }]}
    >
      <WebHead>
        <title>{pageTitle}</title>
      </WebHead>
      {/* iOS: after the first layout, so a first field's autofocus meets the right keyboard offset. */}
      {Platform.OS === 'ios' && !height ? null : (
        <View
          style={[
            styles.column,
            besideNav && styles.left,
            sideBySide && styles.wideColumn,
            column && { paddingTop: embedded ? space.lg : statusBar + space.lg, paddingHorizontal: gutter },
            { paddingBottom: bottom },
          ]}
        >
          {/* A desktop browser keeps the drawing beside the step, big; elsewhere it's a band on top. */}
          <View style={sideBySide ? styles.row : styles.flex}>
            <View style={sideBySide && styles.aside}>
              {band({
                top: column ? space.lg : statusBar + space.sm,
                side: column ? space.lg : gutter,
                rounded: column,
                folded: typing && !column,
                size: sideBySide ? 300 : undefined,
              })}
            </View>
            <View style={styles.flex}>
              <ScrollView keyboardShouldPersistTaps="handled" style={styles.flex} contentContainerStyle={[styles.scroll, { paddingHorizontal: side }, sideBySide && styles.sideScroll]}>
                <SlideIn key={stepKey} direction={direction}>
                  <View style={styles.heading}>
                    <Eyebrow>{eyebrow}</Eyebrow>
                    <Title role="heading">{title}</Title>
                    {intro ? <Body tone="muted">{intro}</Body> : null}
                  </View>
                  {children}
                </SlideIn>
              </ScrollView>
              <View style={{ paddingHorizontal: side }}>{footer}</View>
            </View>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

/**
 * A step sliding in from the side it comes from. Plain opacity and translate,
 * not Reanimated's entering animations: a layout-animated parent whose children
 * change while typing (balance hints, the folding band) broke Reanimated 4.7's
 * view bookkeeping and crashed iOS (as in #298).
 */
function SlideIn({ direction, children }: { direction: 1 | -1; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const shown = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    shown.set(withSpring(1, { damping: springs.glide.damping, stiffness: springs.glide.stiffness, overshootClamping: true }));
  }, [shown]);
  const slide = useAnimatedStyle(() => ({ opacity: shown.get(), transform: [{ translateX: (1 - shown.get()) * space.xxl * direction }] }));
  return <Animated.View style={[styles.body, slide]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  column: { flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center' },
  wideColumn: { maxWidth: 1080 },
  // 760 on its own; the drawing-beside-the-step layout keeps its 1080.
  left: { alignSelf: 'flex-start', maxWidth: layout.page.text },
  row: { flex: 1, flexDirection: 'row', gap: space.xxl },
  aside: { width: 380 },
  flex: { flex: 1 },
  scroll: { paddingTop: space.lg, paddingBottom: space.xl },
  sideScroll: { paddingTop: 0 },
  body: { gap: space.lg },
  heading: { gap: space.xs },
});
