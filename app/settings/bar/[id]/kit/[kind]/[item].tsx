import { Stack, useLocalSearchParams } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { GlasswareScreen } from '@/components/screens/venue/GlasswareScreen';
import { KitIceScreen } from '@/components/screens/venue/KitIceScreen';
import { KitToolsScreen } from '@/components/screens/venue/KitToolsScreen';

/** One glass, ice or tool in a venue's kit: its own page on a phone, beside its list on a wide screen. */
export default function KitItemRoute() {
  const { id, kind, item } = useLocalSearchParams<{ id: string; kind: string; item: string }>();
  const Screen = kind === 'glassware' ? GlasswareScreen : kind === 'ice' ? KitIceScreen : kind === 'tools' ? KitToolsScreen : null;
  return (
    <VenueBrandProvider barId={id}>
      <Stack.Screen options={{ headerShown: false }} />
      {id && Screen ? <Screen barId={id} openId={item} /> : null}
    </VenueBrandProvider>
  );
}
