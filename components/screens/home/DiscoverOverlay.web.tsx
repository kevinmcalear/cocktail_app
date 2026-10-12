import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Title, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { Appear } from '@/components/ds/Appear';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { space } from '@/constants/tokens';

import { overlayStyles as styles, useOverlayKeys, type DiscoverOverlayProps } from './discoverOverlayParts';

/**
 * The web's DiscoverOverlay: never a bottom sheet on the web (a card, or the
 * whole screen for search at phone width), so there's no drag, and it fades
 * in with CSS: the web doesn't load Reanimated or Gesture Handler for it
 * (DiscoverOverlay.tsx drags on phones).
 */
export function DiscoverOverlay({ label, onClose, full, action, head, footer, children }: DiscoverOverlayProps) {
  const ds = useDs();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const bottom = useTabBarInset();
  const wide = useBreakpoint() !== 'phone';
  const page = full && !wide;
  const card = !page;
  useOverlayKeys(onClose);
  const frame = card
    ? [styles.card, !wide && styles.narrowCard, { borderColor: ds.c.line, backgroundColor: ds.c.ground }]
    : [styles.flex, { paddingTop: insets.top + space.lg, backgroundColor: ds.c.ground }];
  return (
    <Appear kind="fade" duration={160} style={[StyleSheet.absoluteFill, styles.layer]}>
      {page ? null : <Pressable accessibilityLabel="Close" onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: ds.c.scrim }]} />}
      <View role="dialog" aria-modal aria-label={label} style={frame}>
        <View style={[styles.gap, { paddingHorizontal: gutter, paddingBottom: space.md }]}>
          {head ?? (
            <View style={styles.head}>
              <Title role="heading" style={styles.flex}>
                {label}
              </Title>
              {action ?? <Button label="Done" variant="ghost" onPress={onClose} />}
            </View>
          )}
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={card ? styles.shrink : styles.flex}
          contentContainerStyle={[styles.gap, { paddingHorizontal: gutter, paddingBottom: footer ? space.lg : card ? space.xl : bottom }]}
        >
          {children}
        </ScrollView>
        {footer ? <View style={{ paddingHorizontal: gutter, paddingBottom: card ? space.lg : bottom }}>{footer}</View> : null}
      </View>
    </Appear>
  );
}
