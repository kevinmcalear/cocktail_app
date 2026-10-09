import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Caption, GlassButton, Title, useDs, useGutter } from '@/components/ds';
import { WebHead } from '@/components/WebHead';
import { layout, space } from '@/constants/tokens';

interface SafetyPageProps {
  title: string;
  intro?: string;
  /** A small line above the title, like "Step 2 of 4". */
  kicker?: string | null;
  children: ReactNode;
  /** Hide the back button (the age check after sign-up has its own way on). */
  noBack?: boolean;
  /** Where Back goes when there's no history (a link opened cold). */
  backTo?: '/settings' | '/settings/profile' | '/';
}

/** The plain page the safety screens (and Not available) share: a title, a line of intro, a readable column. */
export function SafetyPage(props: SafetyPageProps) {
  return (
    <BackbarTheme>
      <Page {...props} />
    </BackbarTheme>
  );
}

function Page({ title, intro, kicker, children, noBack, backTo = '/settings' }: SafetyPageProps) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>{title}</title>
      </WebHead>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + layout.minTapTarget + space.xl, paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: gutter }}
      >
        <View style={styles.readable}>
          {kicker ? <Caption tone="muted">{kicker}</Caption> : null}
          <Title role="heading">{title}</Title>
          {intro ? <Body tone="muted">{intro}</Body> : null}
          {children}
        </View>
      </ScrollView>
      {noBack ? null : (
        <View style={[styles.back, { top: insets.top + space.sm, left: gutter }]}>
          <GlassButton
            accessibilityLabel={Platform.OS === 'web' ? 'Back' : 'Close'}
            icon={Platform.OS === 'web' ? 'chevron.left' : 'xmark'}
            onPress={() => (router.canGoBack() ? router.back() : router.replace(backTo))}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  readable: { width: '100%', maxWidth: 720, alignSelf: 'center', gap: space.md },
  back: { position: 'absolute' },
});
