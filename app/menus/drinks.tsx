import { Stack } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { OurDrinksScreen } from '@/components/screens/menus/OurDrinksScreen';
import { WebHead } from '@/components/WebHead';

/** A bar's drinks with their runs on its lists, and Bring back. */
export default function OurDrinksRoute() {
  return (
    <VenueBrandProvider>
      <Stack.Screen options={{ headerShown: false, title: 'Our drinks' }} />
      <WebHead>
        <title>Our drinks</title>
      </WebHead>
      <OurDrinksScreen />
    </VenueBrandProvider>
  );
}
