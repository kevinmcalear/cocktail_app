import { Stack } from 'expo-router';

import { TechniquesScreen } from '@/components/screens/techniques/TechniquesScreen';

/** Foam from anything: the Foams and airs group with the picker open over it. */
export default function FoamPickerRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Foam from anything' }} />
      <TechniquesScreen group="foam" foam />
    </>
  );
}
