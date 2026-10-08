import { Redirect } from 'expo-router';

import { StudyScreen } from '@/components/screens/StudyScreen';
import { FEATURES } from '@/constants/features';
import { MountOnFocus } from '@/components/nav/MountOnFocus';

/** The Study tab (its route is still /test, so old links keep working). */
export default function StudyTab() {
  return FEATURES.study ? (
    <MountOnFocus>
      <StudyScreen />
    </MountOnFocus>
  ) : <Redirect href="/" />;
}
