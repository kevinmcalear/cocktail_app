import { useLocalSearchParams } from 'expo-router';

import { DiscoverScreen } from '@/components/screens/home/DiscoverScreen';
import { WantToGoMap } from '@/components/screens/home/WantToGoMap';
import { MountOnFocus } from '@/components/nav/MountOnFocus';
import { useRoundVisit } from '@/hooks/useFirstRound';

/** The Discover tab, in both modes. Collection's "See them on the map" opens it on your Want to go bars alone (/discover?list=want). */
export default function DiscoverTab() {
  useRoundVisit('discover');
  const { list } = useLocalSearchParams<{ list?: string }>();
  return <MountOnFocus>{list === 'want' ? <WantToGoMap /> : <DiscoverScreen />}</MountOnFocus>;
}
