import { Stack, useLocalSearchParams } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { RolePage } from '@/components/screens/venue/RolePage';

/** A role: what it sees, makes and runs, as switches (Kept-team, A role). */
export default function VenueRole() {
  const { id, role } = useLocalSearchParams<{ id: string; role: string }>();
  return (
    <VenueBrandProvider barId={id}>
      <Stack.Screen options={{ headerShown: false, title: 'Role' }} />
      {id && role ? <RolePage barId={id} roleKey={role} /> : null}
    </VenueBrandProvider>
  );
}
