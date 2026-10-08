import { YouScreen } from '@/components/screens/profile/YouScreen';
import { MountOnFocus } from '@/components/nav/MountOnFocus';

/** The You tab, in home mode: your own profile. Settings are behind its gear. */
export default function You() {
  return (
    <MountOnFocus>
      <YouScreen inTabs />
    </MountOnFocus>
  );
}
