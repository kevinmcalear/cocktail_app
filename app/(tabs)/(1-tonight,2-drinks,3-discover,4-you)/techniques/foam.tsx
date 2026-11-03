import { Stack } from 'expo-router';

import { TechniquesScreen } from '@/components/screens/techniques/TechniquesScreen';
import { FeatureGate } from '@/components/nav/FeatureGate';

/** Foam from anything: the Foam group with the picker open over it. */
export default function FoamPickerRoute() {
  return (
    <FeatureGate feature="techniques">
      <>
        <Stack.Screen options={{ headerShown: false, title: 'Foam from anything' }} />
        <TechniquesScreen group="foam" foam />
      </>
    </FeatureGate>
  );
}
