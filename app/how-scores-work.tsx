import { Stack, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, GlassButton, useDs, useGutter } from '@/components/ds';
import { ScoresMethod } from '@/components/screens/rankings/ScoresMethod';
import { layout, space } from '@/constants/tokens';

/** How scores work, the published method, from a rankings page (Next-phone "method"). */
export default function HowScoresWorkRoute() {
  return (
    <BackbarTheme>
      <Stack.Screen options={{ headerShown: false, title: 'How scores work' }} />
      <Page />
    </BackbarTheme>
  );
}

function Page() {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + layout.minTapTarget + space.lg, paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: gutter }}>
        <View style={styles.page}>
          <ScoresMethod />
        </View>
      </ScrollView>
      <View style={[styles.top, { top: insets.top + space.sm, left: gutter }]}>
        <GlassButton accessibilityLabel="Back" icon="chevron.left" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { width: '100%', maxWidth: 600, alignSelf: 'center' },
  top: { position: 'absolute' },
});
