import { Stack, useLocalSearchParams } from 'expo-router';

import { TechniquesScreen } from '@/components/screens/techniques/TechniquesScreen';

/** The technique library. `?group=clarify` opens one group (from a prep card's tag). */
export default function TechniquesRoute() {
  const { group } = useLocalSearchParams<{ group?: string }>();
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Techniques' }} />
      <TechniquesScreen group={group} />
    </>
  );
}
