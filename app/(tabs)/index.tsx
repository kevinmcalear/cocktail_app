import { Redirect } from 'expo-router';

import { TonightScreen } from '@/components/screens/TonightScreen';
import { useMode } from '@/hooks/useMode';

/** The first tab: Tonight at a venue. Home mode has no Tonight, so it opens on Discover. */
export default function FirstTab() {
  return useMode().mode === 'home' ? <Redirect href="/discover" /> : <TonightScreen />;
}
