import { Stack } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { RotaScreen } from '@/components/screens/rota/RotaScreen';
import { WebHead } from '@/components/WebHead';

/** The venue's rota. Its team read it; people with Staff write it. From Tonight's On shift and the sidebar. */
export default function RotaRoute() {
  return (
    <VenueBrandProvider>
      <Stack.Screen options={{ headerShown: false, title: 'Rota' }} />
      <WebHead>
        <title>Rota</title>
      </WebHead>
      <RotaScreen />
    </VenueBrandProvider>
  );
}
