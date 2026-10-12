import { Stack } from 'expo-router';

import { BackbarTheme } from '@/components/ds';
import { EquipmentScreen } from '@/components/screens/techniques/EquipmentScreen';

/** The equipment list, and the kit you have. */
export default function EquipmentRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Equipment' }} />
      {/* The library is drawn light, like Make: the screen's own colours read the same theme. */}
      <BackbarTheme scheme="light">
        <EquipmentScreen />
      </BackbarTheme>
    </>
  );
}
