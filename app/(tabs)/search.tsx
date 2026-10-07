import { CommandSearch } from '@/components/CommandSearch';
import { BackbarTheme, Title, useDs } from '@/components/ds';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { space } from '@/constants/tokens';
import { useSearchCatalog } from '@/hooks/useSearchCatalog';
import { Stack, useIsFocused } from 'expo-router';
import { Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Phone search tab: behind the bar the main job is finding a spec fast. On web
 * the field is focused as soon as the tab opens; on iOS and Android the keyboard
 * would cover the tab bar and half the results, so it waits for a tap. Tapping
 * outside the field or dragging the results puts the keyboard away. Wide web
 * uses ⌘K / the sidebar.
 */
export default function SearchScreen() {
  return (
    <BackbarTheme>
      <Stack.Screen options={{ headerShown: false }} />
      <Search />
    </BackbarTheme>
  );
}

function Search() {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const tabBarInset = useTabBarInset();
  const isFocused = useIsFocused();
  const { items } = useSearchCatalog();

  return (
    <Pressable onPress={Keyboard.dismiss} accessible={false} tabIndex={-1} style={styles.fill}>
      <View style={[styles.screen, { backgroundColor: ds.c.ground, paddingTop: insets.top + space.md }]}>
        <Title style={styles.title}>Search</Title>
        {isFocused ? (
          <CommandSearch
            items={items}
            autoFocus={Platform.OS === 'web'}
            showFooter={false}
            bottomInset={tabBarInset}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  screen: { flex: 1, paddingHorizontal: space.md, gap: space.sm },
  title: { paddingHorizontal: space.xs },
});
