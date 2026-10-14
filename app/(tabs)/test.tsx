import { Redirect } from 'expo-router';

import { StudyScreen } from '@/components/screens/StudyScreen';
import { MountOnFocus } from '@/components/nav/MountOnFocus';
import { useVenueFeatures } from '@/hooks/useVenueFeatures';

/** The Study tab, when the venue switched Study on (its route is still /test, so old links keep working). */
export default function StudyTab() {
  const { ready, has } = useVenueFeatures();
  if (!ready) return null;
  return has('study') ? (
    <MountOnFocus>
      <StudyScreen />
    </MountOnFocus>
  ) : <Redirect href="/" />;
}
