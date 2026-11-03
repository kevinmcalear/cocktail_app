import { Stack } from 'expo-router';

import { EquipmentScreen } from '@/components/screens/techniques/EquipmentScreen';
import { FeatureGate } from '@/components/nav/FeatureGate';

/** The equipment list, and the kit you have. */
export default function EquipmentRoute() {
  return (
    <FeatureGate feature="techniques">
      <>
        <Stack.Screen options={{ headerShown: false, title: 'Equipment' }} />
        <EquipmentScreen />
      </>
    </FeatureGate>
  );
}
