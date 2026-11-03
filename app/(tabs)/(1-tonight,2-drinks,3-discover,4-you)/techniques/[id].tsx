import { Stack, useLocalSearchParams } from 'expo-router';

import { TechniqueScreen } from '@/components/screens/techniques/TechniqueScreen';
import { techniqueById } from '@/lib/techniques';
import { FeatureGate } from '@/components/nav/FeatureGate';

/** One technique's page. */
export default function TechniqueRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <FeatureGate feature="techniques">
      <>
        <Stack.Screen options={{ headerShown: false, title: techniqueById(id)?.name ?? 'Technique' }} />
        <TechniqueScreen id={id} />
      </>
    </FeatureGate>
  );
}
