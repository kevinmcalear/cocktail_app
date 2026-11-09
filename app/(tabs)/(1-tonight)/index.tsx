import { Redirect } from 'expo-router';

import { MountOnFocus } from '@/components/nav/MountOnFocus';
import { useStartTabUnder } from '@/components/nav/useStartTabUnder';
import { TonightScreen } from '@/components/screens/tonight/TonightScreen';
import { useVenueFeatures } from '@/hooks/useVenueFeatures';

/**
 * The Tonight tab's first page: tonight at your bar, or at home
 * (components/screens/tonight). A venue that hasn't switched Tonight on opens
 * on Drinks instead (lib/venueFeatures.ts), so every link to / lands there too,
 * and a link to a create wizard shows Drinks under its dialog (useStartTabUnder).
 */
export default function TonightTab() {
  const { ready, has, home } = useVenueFeatures();
  useStartTabUnder(ready && !has('tonight') ? home : null);
  if (!ready) return null;
  if (!has('tonight')) return <Redirect href={home} />;
  return (
    <MountOnFocus>
      <TonightScreen />
    </MountOnFocus>
  );
}
