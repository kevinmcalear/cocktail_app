import { Redirect } from 'expo-router';

import { StudyScreen } from '@/components/screens/StudyScreen';
import { FEATURES } from '@/constants/features';

/** The Study tab (its route is still /test, so old links keep working). */
export default function StudyTab() {
  return FEATURES.study ? <StudyScreen /> : <Redirect href="/" />;
}
