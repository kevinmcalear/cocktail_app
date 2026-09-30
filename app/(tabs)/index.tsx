import { DiscoverScreen } from '@/components/screens/home/DiscoverScreen';
import { TonightScreen } from '@/components/screens/TonightScreen';
import { useMode } from '@/hooks/useMode';

/** The first tab: Tonight at a venue, Discover at home. */
export default function FirstTab() {
  return useMode().mode === 'home' ? <DiscoverScreen /> : <TonightScreen />;
}
