import { Stack, useLocalSearchParams } from 'expo-router';

import { EquipmentDetailScreen } from '@/components/screens/techniques/EquipmentDetailScreen';
import { equipmentById } from '@/lib/techniques';

/** One piece of equipment. */
export default function EquipmentDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: equipmentById(id)?.name ?? 'Equipment' }} />
      <EquipmentDetailScreen id={id} />
    </>
  );
}
