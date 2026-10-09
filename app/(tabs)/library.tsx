import { Redirect } from 'expo-router';

import { LibraryScreen } from '@/components/screens/LibraryScreen';
import { MountOnFocus } from '@/components/nav/MountOnFocus';
import { useMode } from '@/hooks/useMode';

/** The Library tab, in venue mode. At home (an old link, the back button) it would show the last venue's drinks. */
export default function Library() {
  if (useMode().mode === 'home') return <Redirect href="/discover" />;
  return (
    <MountOnFocus>
      <LibraryScreen />
    </MountOnFocus>
  );
}
