import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Caption, dragDismissesKeyboard, GlassButton, Title, useDs, useGutter } from '@/components/ds';
import { fontFamilies, layout, space } from '@/constants/tokens';

interface Props {
  eyebrow?: string;
  title: string;
  /** Said under the title. */
  intro?: ReactNode;
  children: ReactNode;
  /** Floating over the foot of the page (the library's My kit pill). */
  footer?: ReactNode;
}

/** The frame every technique and equipment screen shares: a back button, a title, a readable column. Drawn light, like Make. */
export function TechniquePage(props: Props) {
  return (
    <BackbarTheme scheme="light">
      <Frame {...props} />
    </BackbarTheme>
  );
}

function Frame({ eyebrow, title, intro, children, footer }: Props) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView
        {...dragDismissesKeyboard}
        contentContainerStyle={[styles.page, { paddingTop: insets.top + layout.minTapTarget + space.lg, paddingBottom: insets.bottom + space.xxxl + (footer ? layout.minTapTarget + space.xl : 0), paddingHorizontal: gutter }]}
      >
        <View style={styles.header}>
          {eyebrow ? (
            <Caption tone="muted" style={styles.eyebrow}>
              {eyebrow.toUpperCase()}
            </Caption>
          ) : null}
          <Title role="heading">{title}</Title>
          {intro}
        </View>
        {children}
      </ScrollView>
      {footer ? (
        <View pointerEvents="box-none" style={[styles.footer, { bottom: insets.bottom + space.md, paddingHorizontal: gutter }]}>
          {footer}
        </View>
      ) : null}
      <View style={[styles.back, { top: insets.top + space.sm, left: gutter }]}>
        <GlassButton
          accessibilityLabel={Platform.OS === 'web' ? 'Back' : 'Close'}
          icon={Platform.OS === 'web' ? 'chevron.left' : 'xmark'}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/techniques' as never))}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: space.xl },
  header: { gap: space.sm },
  eyebrow: { fontFamily: fontFamilies.mono, letterSpacing: 1 },
  back: { position: 'absolute' },
  footer: { position: 'absolute', left: 0, right: 0 },
});
