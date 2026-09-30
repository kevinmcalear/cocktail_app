import { CommandSearch } from '@/components/CommandSearch';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { useSearchCatalog } from '@/hooks/useSearchCatalog';
import { Stack, useIsFocused } from 'expo-router';
import { Keyboard, Platform, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, YStack } from 'tamagui';

/**
 * Phone search tab: behind the bar the main job is finding a spec fast. On web
 * the field is focused as soon as the tab opens; on iOS and Android the keyboard
 * would cover the tab bar and half the results, so it waits for a tap. Tapping
 * outside the field or dragging the results puts the keyboard away. Wide web
 * uses ⌘K / the sidebar.
 */
export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const tabBarInset = useTabBarInset();
  const isFocused = useIsFocused();
  const { items } = useSearchCatalog();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Pressable
        onPress={Keyboard.dismiss}
        accessible={false}
        tabIndex={-1}
        style={{ flex: 1 }}
      >
        <YStack
          flex={1}
          backgroundColor="$background"
          paddingTop={insets.top + 12}
          paddingBottom={tabBarInset}
          paddingHorizontal={12}
          gap={8}
        >
          <Text
            fontSize={28}
            fontWeight="700"
            color="$color"
            letterSpacing={-0.4}
            paddingHorizontal={8}
            role="heading"
          >
            Search
          </Text>
          {isFocused ? (
            <CommandSearch items={items} autoFocus={Platform.OS === 'web'} showFooter={false} />
          ) : null}
        </YStack>
      </Pressable>
    </>
  );
}
