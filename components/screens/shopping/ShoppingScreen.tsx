import { useRouter, type Href } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassButton, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';

import { ShoppingList } from './ShoppingList';

/** The shopping list as its own page (design B, board B2), reached from My Bar's basket and To buy strip. */
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
        <ShoppingList back={sidebar ? undefined : <GlassButton icon="chevron.left" label="My Bar" accessibilityLabel="Back to My Bar" onPress={back} />} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', gap: space.xl },
});
