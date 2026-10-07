import { Redirect } from 'expo-router';

import { PrepScreen } from '@/components/screens/PrepScreen';
import { FEATURES } from '@/constants/features';

/** The Prep tab, in venue mode. */
export default function Prep() {
  return FEATURES.prep ? <PrepScreen /> : <Redirect href="/" />;
}
