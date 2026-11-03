import { Redirect } from 'expo-router';

import { MountOnFocus } from '@/components/nav/MountOnFocus';
import { TonightScreen } from '@/components/screens/tonight/TonightScreen';
import { useVenueFeatures } from '@/hooks/useVenueFeatures';

/**
 * The Tonight tab's first page: tonight at your bar, or at home
 * (components/screens/tonight). A venue that hasn't switched Tonight on opens
 * on Drinks instead (lib/venueFeatures.ts), so every link to / lands there too.
 */
export default function TonightTab() {
  const { ready, has } = useVenueFeatures();
  if (!ready) return null;
  if (!has('tonight')) return <Redirect href="/drinks" />;
  return (
    <MountOnFocus>
      <TonightScreen />
    </MountOnFocus>
  );
}
