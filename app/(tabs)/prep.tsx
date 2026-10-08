import { Redirect } from 'expo-router';

import { PrepScreen } from '@/components/screens/PrepScreen';
import { FEATURES } from '@/constants/features';
import { MountOnFocus } from '@/components/nav/MountOnFocus';

/** The Prep tab, in venue mode. */
export default function Prep() {
  return FEATURES.prep ? (
    <MountOnFocus>
      <PrepScreen />
    </MountOnFocus>
  ) : <Redirect href="/" />;
}
