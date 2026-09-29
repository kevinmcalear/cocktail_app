import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, GlassButton, Title, useDs, useGutter } from '@/components/ds';
import { WebHead } from '@/components/WebHead';
import { layout, space } from '@/constants/tokens';

interface SafetyPageProps {
  title: string;
  intro?: string;
  children: ReactNode;
  /** Hide the back button (the age check after sign-up has its own way on). */
  noBack?: boolean;
}

/** The plain page the safety screens share: a title, a line of intro, a readable column. */
export function SafetyPage(props: SafetyPageProps) {
  return (
    <BackbarTheme>
      <Page {...props} />
    </BackbarTheme>
  );
}

function Page({ title, intro, children, noBack }: SafetyPageProps) {
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
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
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
