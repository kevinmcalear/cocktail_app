import { Stack, useLocalSearchParams } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { RolesScreen } from '@/components/screens/venue/RolesScreen';

/** Roles and access: what each base level and the venue's own roles can do. */
export default function VenueRoles() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <VenueBrandProvider barId={id}>
      <Stack.Screen options={{ headerShown: false, title: 'Roles and access' }} />
      {id ? <RolesScreen barId={id} /> : null}
    </VenueBrandProvider>
  );
}
