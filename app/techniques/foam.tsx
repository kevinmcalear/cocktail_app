import { Stack } from 'expo-router';

import { FoamPickerScreen } from '@/components/screens/techniques/FoamPickerScreen';

/** Foam from anything: four questions, one foamer to start with. */
export default function FoamPickerRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Foam from anything' }} />
      <FoamPickerScreen />
    </>
  );
}
