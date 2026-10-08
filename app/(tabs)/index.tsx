import { Redirect } from 'expo-router';

import { MountOnFocus } from '@/components/nav/MountOnFocus';
import { TonightScreen } from '@/components/screens/TonightScreen';
import { useMode } from '@/hooks/useMode';

/** The first tab: Tonight at a venue. Home mode has no Tonight, so it opens on Discover. */
export default function FirstTab() {
  if (useMode().mode === 'home') return <Redirect href="/discover" />;
  return (
    <MountOnFocus>
      <TonightScreen />
    </MountOnFocus>
  );
}
