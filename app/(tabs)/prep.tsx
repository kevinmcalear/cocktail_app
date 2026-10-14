import { Redirect } from 'expo-router';

import { PrepScreen } from '@/components/screens/PrepScreen';
import { MountOnFocus } from '@/components/nav/MountOnFocus';
import { useVenueFeatures } from '@/hooks/useVenueFeatures';

/** The Prep tab, in venue mode, when the venue switched Prep on. */
export default function Prep() {
  const { ready, has } = useVenueFeatures();
  if (!ready) return null;
  return has('prep') ? (
    <MountOnFocus>
      <PrepScreen />
    </MountOnFocus>
  ) : <Redirect href="/" />;
}
