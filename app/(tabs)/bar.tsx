import { Redirect } from 'expo-router';

import { MyBarScreen } from '@/components/screens/home/MyBarScreen';
import { useRedesign } from '@/lib/flags';

/** Redesign-only tab, in home mode. */
export default function MyBar() {
  return useRedesign() ? <MyBarScreen /> : <Redirect href="/" />;
}
