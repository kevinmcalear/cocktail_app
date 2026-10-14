import { Stack, useLocalSearchParams } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { KitToolsScreen } from '@/components/screens/venue/KitToolsScreen';

/** A venue's tools, under Kit in its settings. */
export default function ToolsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <VenueBrandProvider barId={id}>
      <Stack.Screen options={{ headerShown: false }} />
      {id ? <KitToolsScreen barId={id} /> : null}
    </VenueBrandProvider>
  );
}
