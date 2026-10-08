import { SettingsScreen } from '@/components/SettingsScreen';
import { Stack } from 'expo-router';

export default function SettingsRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Settings' }} />
      <SettingsScreen />
    </>
  );
}
