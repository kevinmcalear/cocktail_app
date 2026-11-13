import { usePreventRemove } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, DsText, GlassButton, Head, PressableScale, Title, useDs, useGutter } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';

/**
 * The system back (the browser's Back, Android's back) during first run's
 * steps goes one step back, like the page's own Back, instead of leaving
 * setup; with no step to go back to it does nothing. `held` false lets the
 * page go, for setup's own way out when it ends.
 */
export function useStepBack(held: boolean, back: (() => void) | undefined) {
  usePreventRemove(held, () => back?.());
}

/**
 * The board's page for first run's steps (Prod-first 3 and 4, Loop-want 3): a
 * glass Back, the round Next when there is one (drawn filled even before it
 * can go, as the board draws it), the top bar's own title or the big title and
 * its line, left. The board's 38 and 36 titles take the nearest type steps:
 * head (40) and title (34).
 */
export function FirstRunPage({
  onBack,
  onNext,
  nextReady,
  held = true,
  size = 'title',
  barTitle,
  title,
  sub,
  children,
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextReady?: boolean;
  /** The system back steps back here (useStepBack) until setup is leaving. */
  held?: boolean;
  size?: 'head' | 'title';
  /** The top bar's own title ("3 of 10"), for a page with no big title. */
  barTitle?: string;
  title?: string;
  sub?: string;
  children: ReactNode;
}) {
  useStepBack(held, onBack);
  const Heading = size === 'head' ? Head : Title;
  const ds = useDs();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  return (
    <BackbarTheme>
      <View style={[styles.fill, { backgroundColor: ds.c.ground }]}>
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.xxl, paddingHorizontal: gutter }}>
          <View style={styles.column}>
            <View style={styles.top}>
              {onBack ? <GlassButton accessibilityLabel="Back" icon="chevron.left" onPress={onBack} /> : <View />}
              {barTitle ? (
                <DsText variant="headline" role="heading" align="center" pointerEvents="none" style={styles.barTitle}>
                  {barTitle}
                </DsText>
              ) : null}
              {onNext ? (
                <PressableScale role="button" accessibilityLabel="Next" aria-disabled={!nextReady} onPress={onNext} style={[styles.next, { backgroundColor: ds.accentFill.fill }]}>
                  <IconSymbol name="checkmark" size={20} color={ds.accentFill.text} />
                </PressableScale>
              ) : null}
            </View>
            {title ? (
              <View style={styles.head}>
                <Heading>{title}</Heading>
                {sub ? <Body tone="muted">{sub}</Body> : null}
              </View>
            ) : null}
            {children}
          </View>
        </ScrollView>
      </View>
    </BackbarTheme>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  column: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: space.lg },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: layout.minTapTarget },
  barTitle: { position: 'absolute', left: 0, right: 0 },
  next: { width: layout.minTapTarget, height: layout.minTapTarget, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  head: { gap: space.md, paddingTop: space.xl, paddingBottom: space.sm },
});
