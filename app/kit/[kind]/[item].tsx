import { Stack, useLocalSearchParams } from 'expo-router';

import { HomeGlasswareScreen, HomeIceScreen } from '@/components/screens/home/HomeKitScreens';

/** One of your glasses or ice at home: its own page on a phone, beside its list on a wide screen. */
export default function HomeKitItemRoute() {
  const { kind, item } = useLocalSearchParams<{ kind: string; item: string }>();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {kind === 'glassware' ? <HomeGlasswareScreen openId={item} /> : kind === 'ice' ? <HomeIceScreen openId={item} /> : null}
    </>
  );
}
