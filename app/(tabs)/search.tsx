import { CommandSearch } from '@/components/CommandSearch';
import { useFloatingTabBarInset } from '@/components/LiquidTabBar';
import { useSearchCatalog } from '@/hooks/useSearchCatalog';
import { Stack, useIsFocused } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, YStack } from 'tamagui';

/**
 * Phone search tab: behind the bar the main job is finding a spec fast, so the
 * field is focused as soon as the tab opens. Wide web uses ⌘K / the sidebar.
 */
export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const tabBarInset = useFloatingTabBarInset();
  const isFocused = useIsFocused();
  const { items } = useSearchCatalog();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
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
        {isFocused ? <CommandSearch items={items} autoFocus showFooter={false} /> : null}
      </YStack>
    </>
  );
}
