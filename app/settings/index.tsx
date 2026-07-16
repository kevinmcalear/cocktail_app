import { SettingsScreen } from '@/components/SettingsScreen';
import { Stack } from 'expo-router';
import { YStack } from 'tamagui';

export default function SettingsRoute() {
  return (
    <YStack flex={1} backgroundColor="$background">
      <Stack.Screen options={{ headerShown: false }} />
      <SettingsScreen />
    </YStack>
  );
}
