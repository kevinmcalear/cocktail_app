import { HomePrompt } from '@/components/HomePrompt';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { YStack } from 'tamagui';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

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
        <HomePrompt />
      </YStack>
    </>
  );
}
