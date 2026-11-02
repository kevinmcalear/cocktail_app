import { Stack, useLocalSearchParams } from 'expo-router';

import { TechniqueScreen } from '@/components/screens/techniques/TechniqueScreen';
import { techniqueById } from '@/lib/techniques';

/** One technique's page. */
export default function TechniqueRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: techniqueById(id)?.name ?? 'Technique' }} />
      <TechniqueScreen id={id} />
    </>
  );
}
