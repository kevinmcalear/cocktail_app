import { createContext, useContext, useEffect, useRef, useState, type ComponentRef, type ReactNode, type RefObject } from 'react';
import { BackHandler, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Caption, Title, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { WebHead } from '@/components/WebHead';
import { space, springs } from '@/constants/tokens';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';

import { Eyebrow, FooterInline } from './WizardChrome';

/** Where the paper band sits, for the band to lay itself out. */
export interface BandPlace {
  top: number;
  side: number;
  rounded: boolean;
  folded: boolean;
  size?: number;
}

/**
 * A step's search over the whole screen while it's in use (canvas Create,
 * Q16): the band, heading and footer go, so the field sits at the top and its
 * results run down to the keyboard. Phones only; null elsewhere.
 */
export interface WizardTakeover {
  on: boolean;
  set: (on: boolean) => void;
}

const Takeover = createContext<WizardTakeover | null>(null);

/** The frame's takeover, for a step's search; null outside a phone's wizard (the desktop page, tests). */
export function useWizardTakeover() {
  return useContext(Takeover);
}

/** Around the search that takes the screen (the draft page's spec, not its sheets, whose searches stay in the sheet). */
export const TakeoverProvider = Takeover.Provider;

/**
 * The takeover's state, for the screen that hides around the search: it opens
 * at the top; closed, the page is back where it was, the new line above the
 * field. Android's back closes a search first, then `onBack` (true when it
 * handled it, false to leave).
 */
export function useSearchTakeover(scroller: RefObject<ComponentRef<typeof ScrollView> | null>, phone: boolean, onBack: () => boolean = () => false) {
  const [on, setOn] = useState(false);
  const scrolled = useRef(0);
  const keptAt = useRef(0);
  useEffect(() => scroller.current?.scrollTo?.({ y: on ? 0 : keptAt.current, animated: false }), [on, scroller]);
  const set = (next: boolean) => {
    if (next === on) return;
    if (next) keptAt.current = scrolled.current;
    else Keyboard.dismiss();
    setOn(next);
  };
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!(on && phone)) return onBack();
      set(false);
      return true;
    });
    return () => sub.remove();
  });
  return {
    /** Only a phone needs the room: wider screens show the field and its results with the keyboard up. */
    over: phone && on,
    takeover: phone ? { on, set } : null,
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void (scrolled.current = e.nativeEvent.contentOffset.y),
  };
}

/**
 * A screen that stays above the keyboard. `children` gets the status bar it
 * still has to clear. On iOS the screen is a page sheet that starts below the
 * status bar: its gap to the window's top is both the inset it doesn't need
 * and what KeyboardAvoidingView (which assumes it starts at the top) must
 * add. A full-screen Modal (House-made over a drink) measures a hair short of
 * the window (873.99994 of 874), so under a point is no gap: that screen
 * still has the status bar to clear.
 */
export function KeyboardScreen({ testID, embedded, children }: { testID: string; embedded?: boolean; children: (statusBar: number) => ReactNode }) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const windowHeight = useWindowDimensions().height;
  const [height, setHeight] = useState(0);
  const gap = windowHeight - height;
  const sheetGap = Platform.OS === 'ios' && !embedded && height && gap >= 1 ? gap : 0;
  return (
    <KeyboardAvoidingView
      // Android draws edge to edge, so the window doesn't shrink for the keyboard: the screen does.
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={sheetGap}
      testID={testID}
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
      style={[styles.screen, { backgroundColor: ds.c.ground }]}
    >
      {/* iOS: after the first layout, so a first field's autofocus meets the right keyboard offset. */}
      {Platform.OS === 'ios' && !height ? null : children(sheetGap > 0 ? 0 : insets.top)}
    </KeyboardAvoidingView>
  );
}

export interface WizardFrameProps {
  testID: string;
  /** The browser tab's title. */
  pageTitle: string;
  /** Inside the desktop workspace: no safe-area padding. */
  embedded?: boolean;
  /** Over the whole screen (a modal): there is no side nav to sit beside, so the column stays centred. */
  overNav?: boolean;
  band: (place: BandPlace) => ReactNode;
  /** Changes with the step, so its body slides in. */
  stepKey: string;
  direction: 1 | -1;
  eyebrow: string;
  title: string;
  intro?: string;
  /** Right of the title: a small control for the whole step (Parts or Amounts). */
  aside?: ReactNode;
  footer: ReactNode;
  /** Android's back button: true when it stepped back, false to leave. */
  onHardwareBack: () => boolean;
  children: ReactNode;
}

/**
 * The screen every add wizard shares: the paper band with its drawing on
 * top, one step at a time sliding in, and the footer pinned above the
 * keyboard. On a phone the band folds to its controls while typing, so the
 * field and the keyboard both fit, and a step's search can take the whole
 * screen (useWizardTakeover). A desktop browser has one 760 column
 * that scrolls as a page: the band as a rounded card, the step, then Skip
 * and Next at its end.
 */
export function WizardFrame({ testID, pageTitle, embedded, overNav, band, stepKey, direction, eyebrow, title, intro, aside, footer, onHardwareBack, children }: WizardFrameProps) {
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const breakpoint = useBreakpoint();
  // Beside the side nav on wide web the column sits left, next to it, never centred (b07).
  const besideNav = useIsWideWeb() && !embedded && !overNav;
  // One scroll view for every step, so a new step (forward or back) opens at its top, not where the last one was left.
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  useEffect(() => scroller.current?.scrollTo({ y: 0, animated: false }), [stepKey]);

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
  const page = breakpoint === 'desktop' && !embedded;
  const { over, takeover, onScroll } = useSearchTakeover(scroller, !column, onHardwareBack);
  const side = column ? 0 : gutter;
  const bottom = embedded ? space.lg : Math.max(insets.bottom, space.lg);

  return (
    <Takeover.Provider value={takeover}>
      <WebHead>
        <title>{pageTitle}</title>
      </WebHead>
      <KeyboardScreen testID={testID} embedded={embedded}>
        {(statusBar) => (
          <View style={[styles.column, page && styles.pageColumn, besideNav && styles.left, column && !page && { paddingTop: embedded ? space.lg : statusBar + space.lg, paddingHorizontal: gutter }, over && { paddingTop: statusBar + space.sm }, { paddingBottom: page ? 0 : bottom }]}>
            {page ? (
              <ScrollView ref={scroller} keyboardShouldPersistTaps="handled" style={styles.flex} contentContainerStyle={[styles.page, { paddingHorizontal: gutter }]}>
                {band({ top: space.lg, side: space.lg, rounded: true, folded: false })}
                <SlideIn key={stepKey} direction={direction}>
                  <Heading eyebrow={eyebrow} title={title} intro={intro} aside={aside} />
                  {children}
                  <FooterInline.Provider value>{footer}</FooterInline.Provider>
                </SlideIn>
              </ScrollView>
            ) : (
              <>
                {/* Each piece goes to null in place while a search takes over, so the step (and its focused field) stays mounted. */}
                {over ? null : band({ top: column ? space.lg : statusBar + space.sm, side: column ? space.lg : gutter, rounded: column, folded: typing && !column })}
                <ScrollView
                  ref={scroller}
                  keyboardShouldPersistTaps="handled"
                  onScroll={onScroll}
                  scrollEventThrottle={32}
                  style={styles.flex}
                  contentContainerStyle={[styles.scroll, over && styles.over, { paddingHorizontal: side }]}
                >
                  <SlideIn key={stepKey} direction={direction}>
                    {over ? null : <Heading eyebrow={eyebrow} title={title} intro={intro} aside={aside} />}
                    {children}
                  </SlideIn>
                </ScrollView>
                {over ? null : <View style={{ paddingHorizontal: side }}>{footer}</View>}
              </>
            )}
          </View>
        )}
      </KeyboardScreen>
    </Takeover.Provider>
  );
}

function Heading({ eyebrow, title, intro, aside }: { eyebrow: string; title: string; intro?: string; aside?: ReactNode }) {
  return (
    <View style={styles.heading}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <View style={styles.titleRow}>
        <Title role="heading" style={styles.flex}>
          {title}
        </Title>
        {aside}
      </View>
      {intro ? <Caption tone="muted">{intro}</Caption> : null}
    </View>
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
  // 760 column; the shell's b07 sets it left of centre beside the side nav.
  left: { alignSelf: 'flex-start' },
  pageColumn: { maxWidth: 760 + 2 * space.xxl },
  flex: { flex: 1 },
  scroll: { paddingTop: space.lg, paddingBottom: space.xl },
  over: { paddingTop: 0 },
  page: { gap: space.lg, paddingTop: space.xxl, paddingBottom: space.xxxl },
  body: { gap: space.lg },
  // The canvas spaces the kicker, title and intro like the step's own rows.
  heading: { gap: space.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
