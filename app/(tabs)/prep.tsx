import { Redirect } from 'expo-router';

import { PrepScreen } from '@/components/screens/PrepScreen';
import { useRedesign } from '@/lib/flags';

/** Redesign-only tab. */
export default function Prep() {
  return useRedesign() ? <PrepScreen /> : <Redirect href="/" />;
}
