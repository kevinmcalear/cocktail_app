import { Stack } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { OurDrinks } from '@/components/screens/menus/OurDrinks';
import { WebHead } from '@/components/WebHead';

/** Every drink the venue has put on a list, with its runs; past ones can come back (Menu-l-drinks). */
export default function OurDrinksRoute() {
  return (
    <VenueBrandProvider>
      <Stack.Screen options={{ headerShown: false, title: 'Our drinks' }} />
      <WebHead>
        <title>Our drinks</title>
      </WebHead>
      <OurDrinks />
    </VenueBrandProvider>
  );
}
