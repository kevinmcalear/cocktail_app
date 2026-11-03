import { Stack, useLocalSearchParams } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { RolesScreen } from '@/components/screens/venue/RolesScreen';

/** Roles: every role at the venue, what it does and how many hold it (Kept-team). */
export default function VenueRoles() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <VenueBrandProvider barId={id}>
      <Stack.Screen options={{ headerShown: false, title: 'Roles' }} />
      {id ? <RolesScreen barId={id} /> : null}
    </VenueBrandProvider>
  );
}
