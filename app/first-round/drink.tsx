import { Redirect, useLocalSearchParams } from 'expo-router';

import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { RoundDrinkScreen } from '@/components/screens/firstRound/RoundDrinkScreenLazy';

/** One of tonight's drinks in the first round (?id=), read one at a time. A query, not a path, so the web needs no rewrite. */
export default function FirstRoundDrinkRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  if (!id) return <Redirect href="/first-round" />;
  return (
    <VenueBrandProvider>
      <RoundDrinkScreen key={id} id={id} />
    </VenueBrandProvider>
  );
}
