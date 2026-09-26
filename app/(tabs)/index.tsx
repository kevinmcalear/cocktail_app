import { HomePrompt } from '@/components/HomePrompt';
import { DiscoverScreen } from '@/components/screens/home/DiscoverScreen';
import { TonightScreen } from '@/components/screens/TonightScreen';
import { useMode } from '@/hooks/useMode';
import { useRedesign } from '@/lib/flags';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { YStack } from 'tamagui';

/** The first tab: Tonight at a venue, Discover at home. */
function FirstTab() {
  return useMode().mode === 'home' ? <DiscoverScreen /> : <TonightScreen />;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const redesign = useRedesign();
  if (redesign) return <FirstTab />;

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
