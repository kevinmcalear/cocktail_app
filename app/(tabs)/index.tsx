import { CommandFilter } from '@/components/CommandSearch';
import { HomePrompt } from '@/components/HomePrompt';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { YStack } from 'tamagui';

export default function HomeScreen() {
  const { q, filter } = useLocalSearchParams<{ q?: string; filter?: string }>();
  const insets = useSafeAreaInsets();

  const initialFilter =
    filter &&
    ['All', 'Menus', 'Cocktails', 'Beer', 'Wine', 'Ingredients'].includes(filter)
      ? (filter as CommandFilter)
      : 'All';

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <YStack
        flex={1}
        backgroundColor="$background"
        paddingTop={insets.top}
        paddingBottom={insets.bottom}
        minHeight={0}
      >
        <HomePrompt
          initialQuery={typeof q === 'string' ? q : ''}
          initialFilter={initialFilter}
        />
      </YStack>
    </>
  );
}
