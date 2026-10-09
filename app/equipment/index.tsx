import { Stack } from 'expo-router';

import { EquipmentScreen } from '@/components/screens/techniques/EquipmentScreen';

/** The equipment list, and the kit you have. */
export default function EquipmentRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Equipment' }} />
      <EquipmentScreen />
    </>
  );
}
