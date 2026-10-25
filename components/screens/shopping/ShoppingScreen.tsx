import { useRouter, type Href } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassButton, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';

import { ShoppingBody } from './ShoppingBody';

/** The shopping list as its own page: phones, and anywhere My Bar's desktop column isn't. */
export function ShoppingScreen() {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const wide = useBreakpoint() !== 'phone';
  const sidebar = useIsWideWeb();
  const back = () => (router.canGoBack() ? router.back() : router.navigate('/bar' as Href));
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + (sidebar ? space.xxl : space.sm), paddingHorizontal: gutter, paddingBottom: insets.bottom + space.xxxl, maxWidth: wide ? 640 : undefined, alignSelf: sidebar ? 'flex-start' : 'center' }]}
      >
        <ShoppingBody back={sidebar ? null : <GlassButton icon="chevron.left" label="My Bar" accessibilityLabel="Back to My Bar" onPress={back} />} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', gap: space.xl },
});
