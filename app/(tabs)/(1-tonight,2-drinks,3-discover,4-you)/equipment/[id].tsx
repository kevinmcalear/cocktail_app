import { Stack, useLocalSearchParams } from 'expo-router';

import { EquipmentDetailScreen } from '@/components/screens/techniques/EquipmentDetailScreen';
import { equipmentById } from '@/lib/techniques';
import { FeatureGate } from '@/components/nav/FeatureGate';
import { TechniquesGate } from '@/components/techniques/TechniquesGate';

/** One piece of equipment. */
export default function EquipmentDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <FeatureGate feature="techniques">
      <TechniquesGate>
        <Title id={id} />
        <EquipmentDetailScreen id={id} />
      </TechniquesGate>
    </FeatureGate>
  );
}

/** Its name in the tab title: under the gate, so it reads the loaded library. */
function Title({ id }: { id: string }) {
  return <Stack.Screen options={{ headerShown: false, title: equipmentById(id)?.name ?? 'Equipment' }} />;
}
