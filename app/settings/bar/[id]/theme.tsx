import { Stack, useLocalSearchParams } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { ThemeScreen } from '@/components/screens/venue/theme/ThemeScreen';

/** A venue's theme: its colour and background, its face for names, its logo and home-screen icon. */
export default function VenueTheme() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <VenueBrandProvider barId={id}>
      <Stack.Screen options={{ headerShown: false, title: 'Theme' }} />
      {id ? <ThemeScreen barId={id} /> : null}
    </VenueBrandProvider>
  );
}
