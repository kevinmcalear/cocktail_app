import { Stack, useLocalSearchParams } from 'expo-router';

import { BackbarTheme } from '@/components/ds';
import { TechniquesScreen } from '@/components/screens/techniques/TechniquesScreen';

/** The technique library. `?group=clarify` opens one group (from a prep card's tag). */
export default function TechniquesRoute() {
  const { group } = useLocalSearchParams<{ group?: string }>();
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Techniques' }} />
      {/* The library is drawn light, like Make: the screen's own colours read the same theme. */}
      <BackbarTheme scheme="light">
        <TechniquesScreen group={group} />
      </BackbarTheme>
    </>
  );
}
