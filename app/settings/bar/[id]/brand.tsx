import { Stack, useLocalSearchParams } from 'expo-router';

import { BackbarTheme } from '@/components/ds';
import { BrandScreen } from '@/components/screens/venue/BrandScreen';

/** A venue's brand: logo, accent, display face, dark ground, home-screen icon. */
export default function VenueBrand() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <BackbarTheme>
      <Stack.Screen options={{ headerShown: false, title: 'Brand' }} />
      {id ? <BrandScreen barId={id} /> : null}
    </BackbarTheme>
  );
}
