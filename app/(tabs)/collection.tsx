import { Redirect } from 'expo-router';

import { CollectionScreen } from '@/components/screens/home/CollectionScreen';
import { useRedesign } from '@/lib/flags';

/** Redesign-only tab, in home mode. */
export default function Collection() {
  return useRedesign() ? <CollectionScreen /> : <Redirect href="/" />;
}
