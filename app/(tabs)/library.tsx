import { LibraryScreen } from '@/components/screens/LibraryScreen';
import { MountOnFocus } from '@/components/nav/MountOnFocus';

/** The Library tab, in venue mode. */
export default function Library() {
  return (
    <MountOnFocus>
      <LibraryScreen />
    </MountOnFocus>
  );
}
