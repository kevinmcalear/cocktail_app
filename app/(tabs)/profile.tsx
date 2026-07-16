import { SettingsScreen } from '@/components/SettingsScreen';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { YStack } from 'tamagui';

/** Native profile tab = same consolidated settings screen as web. */
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();

  return (
    <YStack flex={1} paddingTop={insets.top} backgroundColor="$background">
      <Stack.Screen options={{ headerShown: false }} />
      <SettingsScreen />
    </YStack>
  );
}
