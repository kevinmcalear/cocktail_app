import { Stack, useLocalSearchParams } from 'expo-router';

import { HomeGlasswareScreen, HomeIceScreen } from '@/components/screens/home/HomeKitScreens';

/** My Bar › Kit › Glassware or Ice: the glasses and ice you have at home. */
export default function HomeKitRoute() {
  const { kind } = useLocalSearchParams<{ kind: string }>();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {kind === 'glassware' ? <HomeGlasswareScreen /> : kind === 'ice' ? <HomeIceScreen /> : null}
    </>
  );
}
