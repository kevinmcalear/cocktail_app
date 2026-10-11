import { Stack, useLocalSearchParams } from 'expo-router';

import { BackbarTheme } from '@/components/ds';
import { TechniqueScreen } from '@/components/screens/techniques/TechniqueScreen';
import { techniqueById } from '@/lib/techniques';

/** One technique's page. */
export default function TechniqueRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: techniqueById(id)?.name ?? 'Technique' }} />
      {/* The library is drawn light, like Make: the screen's own colours read the same theme. */}
      <BackbarTheme scheme="light">
        <TechniqueScreen id={id} />
      </BackbarTheme>
    </>
  );
}
