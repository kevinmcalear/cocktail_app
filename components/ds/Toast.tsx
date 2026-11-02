import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, PanResponder, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { font, layout, radius, space, springs, STATUS } from '@/constants/tokens';
import { toastWarnInk, withAlpha } from '@/lib/color';
import { useToastStore, type Toast } from '@/store/useToastStore';

import { GlassSurface } from './Glass';
import { PressableScale } from './PressableScale';
import { Caption, DsText } from './Text';
import { useDs } from './theme';

/** How long a toast stays when nobody touches it. */
const SHOW_MS = 5000;
const NATIVE = Platform.OS !== 'web';

/**
 * Shows a toast from anywhere (board KittyDone): a title, a line under it and
 * one action, like Undo. The action takes this screen's accent. A new toast
 * replaces the one showing. A save or change that was refused passes
 * `tone: 'error'`, so it never wears the success tick.
 */
export function useToast() {
  const ds = useDs();
  const show = useToastStore((s) => s.show);
  const hide = useToastStore((s) => s.hide);
  return {
    show: (toast: Omit<Toast, 'id' | 'accent'>) => {
      if (NATIVE) void Haptics.notificationAsync(toast.tone === 'error' ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success);
      return show({ ...toast, accent: ds.accentText });
    },
    hide,
  };
}

/**
 * Android: a FAB on screen says where its top is (dp from the screen's bottom
 * edge), so the toast sits above it, as Material's snackbar does. Only while
 * `top` is a number: a FAB on a page under a pushed one passes null.
 */
export function useFabUnderToast(top: number | null) {
  const setFabTop = useToastStore((s) => s.setFabTop);
  useEffect(() => {
    if (Platform.OS !== 'android' || top == null) return;
    setFabTop(top);
    return () => setFabTop(0);
  }, [top, setFabTop]);
}

/**
 * The toast itself, mounted at the root and in each Sheet: a glass pill floating above the
 * bottom edge, or above the tab bar where one shows (`above`, from
 * useTabBarClearance, the root's), and on Android above a FAB on screen; bottom centre on the web,
 * announced politely (an error as an
 * alert), gone after five
 * seconds (an error stays), a swipe or a tap. With Reduce Motion on it fades instead of
 * springing up.
 */
let nextHost = 1;

export function ToastHost({ above = 0 }: { above?: number }) {
  // Mounted at the root and inside every Sheet: the newest host draws, so a
  // toast shown from an open sheet lands on top of it, not under its window.
  const [host] = useState(() => nextHost++);
  useEffect(() => {
    useToastStore.getState().addHost(host);
    return () => useToastStore.getState().removeHost(host);
  }, [host]);
  const top = useToastStore((s) => s.hosts[s.hosts.length - 1] === host);
  const stored = useToastStore((s) => s.toast);
  const toast = top ? stored : null;
  // Kept while it slides away, after the store has moved on.
  const [shown, setShown] = useState<Toast | null>(null);
  if (toast && toast !== shown) setShown(toast);
  const [still, setStill] = useState(false);
  const [move] = useState(() => new Animated.Value(0));
  const [drag] = useState(() => new Animated.ValueXY());
  const [pan] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 6 || Math.abs(g.dx) > 6,
      onPanResponderMove: (_e, g) => drag.setValue({ x: g.dx, y: Math.max(0, g.dy) }),
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 30 || Math.abs(g.dx) > 80) useToastStore.getState().hide();
        else
          Animated.spring(drag, {
            toValue: { x: 0, y: 0 },
            ...springs.snap,
            useNativeDriver: NATIVE,
          }).start();
      },
    })
  );

  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((on) => live && setStill(on));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setStill);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (toast) {
      drag.setValue({ x: 0, y: 0 });
      // A refused save stays until it is tapped, swiped away or replaced (board Sta-errors draws it as a prompt that stays).
      const t = toast.tone === 'error' ? undefined : setTimeout(() => useToastStore.getState().hide(toast.id), SHOW_MS);
      const enter = still
        ? Animated.timing(move, {
            toValue: 1,
            duration: 200,
            useNativeDriver: NATIVE,
          })
        : Animated.spring(move, {
            toValue: 1,
            ...springs.glide,
            useNativeDriver: NATIVE,
          });
      enter.start();
      return () => clearTimeout(t);
    }
    Animated.timing(move, {
      toValue: 0,
      duration: 200,
      useNativeDriver: NATIVE,
    }).start(({ finished }) => finished && setShown(null));
  }, [toast, still, move, drag]);

  if (!shown) return null;
  return <ToastPill toast={shown} move={move} drag={drag} still={still} handlers={pan.panHandlers} above={above} />;
}

function ToastPill({ toast, move, drag, still, handlers, above }: { toast: Toast; move: Animated.Value; drag: Animated.ValueXY; still: boolean; handlers: object; above: number }) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const fabTop = useToastStore((s) => s.fabTop);
  const hide = () => useToastStore.getState().hide(toast.id);
  const error = toast.tone === 'error';
  // The board's warn look: the amber triangle, on an amber wash.
  const amber = toastWarnInk(STATUS.warning, ds.c.raised, ds.c.ground).ink;
  const rise = still ? 0 : move.interpolate({ inputRange: [0, 1], outputRange: [space.xxl, 0] });
  return (
    <View pointerEvents="box-none" style={[styles.layer, { bottom: Math.max(above || insets.bottom, fabTop) + space.lg + (toast.lift ?? 0) }]}>
      <Animated.View
        {...handlers}
        style={[
          styles.slot,
          {
            opacity: move,
            transform: [{ translateY: rise }, { translateX: drag.x }, { translateY: drag.y }],
          },
        ]}
      >
        {/* Thicker than a glass button: words sit on it, so what scrolls behind must not read through. */}
        <GlassSurface style={styles.pill}>
          <View style={[styles.fill, { backgroundColor: withAlpha(ds.c.raised, 0.85) }]}>
            {error ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(STATUS.warning, 0.16) }]} /> : null}
            <PressableScale role={error ? 'alert' : 'status'} aria-live={error ? 'assertive' : 'polite'} accessibilityLabel={[toast.title, toast.detail].filter(Boolean).join('. ')} accessibilityHint="Closes it" haptic={false} onPress={hide} style={styles.body}>
              <IconSymbol name={error ? 'exclamationmark.triangle' : 'checkmark'} size={error ? 18 : 16} color={error ? amber : (toast.accent ?? ds.accentText)} />
              <View style={styles.text}>
                <DsText variant="label" numberOfLines={2} style={styles.title}>
                  {toast.title}
                </DsText>
                {toast.detail ? <Caption tone="muted">{toast.detail}</Caption> : null}
              </View>
            </PressableScale>
            {toast.action ? (
              <PressableScale
                role="button"
                accessibilityLabel={`${toast.action.label}: ${toast.title}`}
                onPress={() => {
                  toast.action?.onPress();
                  hide();
                }}
                style={styles.action}
              >
                <DsText variant="label" color={toast.accent ?? ds.accentText} style={styles.title}>
                  {toast.action.label}
                </DsText>
              </PressableScale>
            ) : null}
          </View>
        </GlassSurface>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Phones: the gutter either side. The web: bottom centre, no wider than a phone's toast.
  layer: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    alignItems: 'center',
  },
  slot: { width: '100%', maxWidth: 480 },
  pill: { borderRadius: radius.pill },
  fill: { flexDirection: 'row', alignItems: 'center' },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingLeft: space.lg,
    paddingVertical: space.sm,
    minHeight: layout.minTapTarget + space.md,
  },
  text: { flex: 1 },
  title: { ...font.semiBold },
  action: {
    minWidth: layout.minTapTarget,
    minHeight: layout.minTapTarget,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
