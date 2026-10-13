import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, PanResponder, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space, springs } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
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
 * replaces the one showing.
 */
export function useToast() {
  const ds = useDs();
  const show = useToastStore((s) => s.show);
  const hide = useToastStore((s) => s.hide);
  return {
    show: (toast: Omit<Toast, 'id' | 'accent'>) => {
      if (NATIVE) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return show({ ...toast, accent: ds.accentText });
    },
    hide,
  };
}

/**
 * The toast itself, mounted once at the root: a glass pill floating above the
 * bottom edge (bottom centre on the web), announced politely, gone after five
 * seconds, a swipe or a tap. With Reduce Motion on it fades instead of
 * springing up.
 */
export function ToastHost() {
  const toast = useToastStore((s) => s.toast);
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
      const t = setTimeout(() => useToastStore.getState().hide(toast.id), SHOW_MS);
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
  return <ToastPill toast={shown} move={move} drag={drag} still={still} handlers={pan.panHandlers} />;
}

function ToastPill({ toast, move, drag, still, handlers }: { toast: Toast; move: Animated.Value; drag: Animated.ValueXY; still: boolean; handlers: object }) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const hide = () => useToastStore.getState().hide(toast.id);
  const rise = still ? 0 : move.interpolate({ inputRange: [0, 1], outputRange: [space.xxl, 0] });
  return (
    <View pointerEvents="box-none" style={[styles.layer, { bottom: insets.bottom + space.lg + (toast.lift ?? 0) }]}>
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
            <PressableScale role="status" aria-live="polite" accessibilityLabel={[toast.title, toast.detail].filter(Boolean).join('. ')} accessibilityHint="Closes it" haptic={false} onPress={hide} style={styles.body}>
              <IconSymbol name="checkmark" size={16} color={toast.accent ?? ds.accentText} />
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
  title: { fontFamily: fontFamilies.bodySemiBold },
  action: {
    minWidth: layout.minTapTarget,
    minHeight: layout.minTapTarget,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
