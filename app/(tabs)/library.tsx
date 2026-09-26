import { Redirect } from 'expo-router';

import { LibraryScreen } from '@/components/screens/LibraryScreen';
import { useRedesign } from '@/lib/flags';

/** Redesign-only tab. */
export default function Library() {
  return useRedesign() ? <LibraryScreen /> : <Redirect href="/" />;
}
