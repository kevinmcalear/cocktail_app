import { Stack, useLocalSearchParams } from 'expo-router';

import { MakerBottlesScreen } from '@/components/screens/maker/MakerBottlesScreen';

/** A maker team's bottles and their photos: /p/harbourlane/bottles (?welcome=1 straight after the claim). */
export default function MakerBottlesRoute() {
  const { id, welcome } = useLocalSearchParams<{ id: string; welcome?: string }>();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <MakerBottlesScreen profileRef={id} welcome={welcome === '1'} />
    </>
  );
}
