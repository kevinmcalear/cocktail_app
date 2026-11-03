import { Stack, useLocalSearchParams } from 'expo-router';

import { BarFeatureGate } from '@/components/bar/BarFeatureGate';
import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { KitToolsScreen } from '@/components/screens/venue/KitToolsScreen';

/** A venue's tools, under Kit in its settings. */
export default function ToolsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <VenueBrandProvider barId={id}>
      <Stack.Screen options={{ headerShown: false }} />
      {id ? (
        <BarFeatureGate barId={id} feature="advanced">
          <KitToolsScreen barId={id} />
        </BarFeatureGate>
      ) : null}
    </VenueBrandProvider>
  );
}
