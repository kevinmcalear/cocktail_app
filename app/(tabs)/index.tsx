import { Redirect } from 'expo-router';

import { MountOnFocus } from '@/components/nav/MountOnFocus';
import { TonightScreen } from '@/components/screens/TonightScreen';
import { useVenueFeatures } from '@/hooks/useVenueFeatures';

/**
 * The first tab: Tonight at a venue that switched it on. Home mode has no
 * Tonight, so it opens on Discover; a venue without it opens on Library.
 */
export default function FirstTab() {
  const { ready, home, has } = useVenueFeatures();
  if (home) return <Redirect href="/discover" />;
  // Until the venue's switches are known, neither Tonight nor a redirect.
  if (!ready) return null;
  if (!has('tonight')) return <Redirect href="/library" />;
  return (
    <MountOnFocus>
      <TonightScreen />
    </MountOnFocus>
  );
}
