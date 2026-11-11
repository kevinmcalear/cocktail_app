import { Stack } from 'expo-router';

import { EquipmentScreen } from '@/components/screens/techniques/EquipmentScreen';
import { FeatureGate } from '@/components/nav/FeatureGate';
import { TechniquesGate } from '@/components/techniques/TechniquesGate';

/** The equipment list, and the kit you have. */
export default function EquipmentRoute() {
  return (
    <FeatureGate feature="techniques">
      <TechniquesGate>
        <Stack.Screen options={{ headerShown: false, title: 'Equipment' }} />
        <EquipmentScreen />
      </TechniquesGate>
    </FeatureGate>
  );
}
