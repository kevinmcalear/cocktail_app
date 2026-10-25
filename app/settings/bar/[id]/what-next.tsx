import { Stack, useLocalSearchParams } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { SetupChecklistScreen } from '@/components/screens/venueSetup/SetupChecklistScreen';

/** "Set up <bar>": the checklist from the end of venue setup (owner-setup step 5). The path keeps What next's name. */
export default function SetupChecklistRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <VenueBrandProvider barId={id}>
      <Stack.Screen options={{ headerShown: false }} />
      {id ? <SetupChecklistScreen barId={id} /> : null}
    </VenueBrandProvider>
  );
}
