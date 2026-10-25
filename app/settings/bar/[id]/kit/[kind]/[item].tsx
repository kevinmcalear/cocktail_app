import { Stack, useLocalSearchParams } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { IceRecipeScreen } from '@/components/screens/ice/IceRecipeScreen';
import { GlasswareScreen } from '@/components/screens/venue/GlasswareScreen';
import { KitIceScreen } from '@/components/screens/venue/KitIceScreen';
import { KitToolsScreen } from '@/components/screens/venue/KitToolsScreen';

/**
 * One glass, ice or tool in a venue's kit: its own page on a phone, beside its
 * list on a wide screen. `?recipe=1` on an ice is how it's made (its recipe
 * editor), so Back returns to the ice.
 */
export default function KitItemRoute() {
  const { id, kind, item, recipe } = useLocalSearchParams<{ id: string; kind: string; item: string; recipe?: string }>();
  const Screen = kind === 'glassware' ? GlasswareScreen : kind === 'ice' ? KitIceScreen : kind === 'tools' ? KitToolsScreen : null;
  return (
    <VenueBrandProvider barId={id}>
      <Stack.Screen options={{ headerShown: false }} />
      {id && kind === 'ice' && item && recipe ? <IceRecipeScreen barId={id} iceId={item} /> : id && Screen ? <Screen barId={id} openId={item} /> : null}
    </VenueBrandProvider>
  );
}
