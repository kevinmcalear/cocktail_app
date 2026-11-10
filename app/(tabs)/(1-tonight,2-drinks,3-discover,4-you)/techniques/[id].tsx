import { Stack, useLocalSearchParams } from 'expo-router';

import { TechniqueScreen } from '@/components/screens/techniques/TechniqueScreen';
import { techniqueById } from '@/lib/techniques';
import { FeatureGate } from '@/components/nav/FeatureGate';
import { TechniquesGate } from '@/components/techniques/TechniquesGate';

/** One technique's page. */
export default function TechniqueRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <FeatureGate feature="techniques">
      <TechniquesGate>
        <Title id={id} />
        <TechniqueScreen id={id} />
      </TechniquesGate>
    </FeatureGate>
  );
}

/** Its name in the tab title: under the gate, so it reads the loaded library. */
function Title({ id }: { id: string }) {
  return <Stack.Screen options={{ headerShown: false, title: techniqueById(id)?.name ?? 'Technique' }} />;
}
