import { Stack, useLocalSearchParams } from 'expo-router';

import { BackbarTheme } from '@/components/ds';
import { EquipmentDetailScreen } from '@/components/screens/techniques/EquipmentDetailScreen';
import { equipmentById } from '@/lib/techniques';

/** One piece of equipment. */
export default function EquipmentDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: equipmentById(id)?.name ?? 'Equipment' }} />
      {/* The library is drawn light, like Make: the screen's own colours read the same theme. */}
      <BackbarTheme scheme="light">
        <EquipmentDetailScreen id={id} />
      </BackbarTheme>
    </>
  );
}
