import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Caption, Display, GlassButton, useDs, useGutter } from '@/components/ds';
import { WebHead } from '@/components/WebHead';
import { layout, space } from '@/constants/tokens';
import { useCreditsToCheck } from '@/hooks/useCreditsToCheck';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';

import { CREDITS_LEAD, CreditRows } from './CreditsToCheck';

/** /credits-to-check: every credit waiting for your yes, opened from All N on You. One centred column on every width. */
export function CreditsToCheckScreen() {
  return (
    <BackbarTheme>
      <Credits />
    </BackbarTheme>
  );
}

function Credits() {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const sidebar = useIsWideWeb();
  const { data, isLoading } = useCreditsToCheck();
  const credits = data ?? [];

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>Credits to check</title>
      </WebHead>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + (sidebar ? space.xxl : space.sm), paddingHorizontal: gutter, paddingBottom: insets.bottom + space.xxxl }]}>
        {sidebar ? null : (
          <View style={styles.top}>
            <GlassButton icon="chevron.left" accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/you'))} />
          </View>
        )}
        <View style={styles.title}>
          <Display>Credits to check</Display>
          <Body tone="muted">{CREDITS_LEAD}</Body>
        </View>
        {credits.length ? <CreditRows credits={credits} /> : isLoading ? null : <Body tone="muted">Nothing to check. Credits people give you wait here for your yes.</Body>}
        <Caption tone="muted">Accept puts the drink on your page and in its credit. Not me hides it, and nobody can name you on that drink again. Changed your mind? Open the drink.</Caption>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: space.lg, width: '100%', maxWidth: layout.page.text, alignSelf: 'center' },
  top: { flexDirection: 'row' },
  title: { gap: space.sm },
});
