import { Stack } from 'expo-router';

import { BackbarTheme } from '@/components/ds';
import { TechniquesScreen } from '@/components/screens/techniques/TechniquesScreen';

/** Foam from anything: the Foams and airs group with the picker open over it. */
export default function FoamPickerRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Foam from anything' }} />
      {/* The library is drawn light, like Make: the screen's own colours read the same theme. */}
      <BackbarTheme scheme="light">
        <TechniquesScreen group="foam" foam />
      </BackbarTheme>
    </>
  );
}
