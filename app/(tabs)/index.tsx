import { HomePrompt } from '@/components/HomePrompt';
import { TonightScreen } from '@/components/screens/TonightScreen';
import { useRedesign } from '@/lib/flags';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { YStack } from 'tamagui';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const redesign = useRedesign();
  if (redesign) return <TonightScreen />;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <YStack
        flex={1}
        backgroundColor="$background"
        paddingTop={insets.top}
        minHeight={0}
      >
        <HomePrompt />
      </YStack>
    </>
  );
}
